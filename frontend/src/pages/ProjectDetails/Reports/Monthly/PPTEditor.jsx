import React, { useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import jsPDF from 'jspdf';
import { toPng, toJpeg } from 'html-to-image';
import {
    X, ChevronLeft, ChevronRight, Plus, Type, AlignLeft,
    Image as ImageIcon, Download, Maximize, Edit3, Save, Play,
    ShieldCheck, Activity, CheckCircle, Eye, MapPin, Target,
    Copy, Trash, GripVertical, Minus, GripHorizontal,
    Bold, Italic, Palette, AlignCenter, AlignRight,
    PieChart, BarChart2, LineChart, EyeOff, LayoutTemplate
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Donut Chart Helper for Slides ---
const SlideDonutChart = ({ data, totalLabel }) => {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    if (total === 0) return null;
    let cumulativePercent = 0;

    const getCoordinatesForPercent = (percent) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    return (
        <div className="relative w-28 h-28 mx-auto">
            <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full drop-shadow-xl">
                {data.map((slice, i) => {
                    const startPercent = cumulativePercent;
                    const slicePercent = slice.value / total;
                    cumulativePercent += slicePercent;
                    const [startX, startY] = getCoordinatesForPercent(startPercent);
                    const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                    const largeArcFlag = slicePercent > 0.5 ? 1 : 0;
                    const pathData = `M ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;
                    return <path key={i} d={pathData} fill={slice.color} className="opacity-90 hover:opacity-100 transition-opacity" />;
                })}
                <circle r="0.7" fill="currentColor" className="text-white dark:text-[#0d1117]" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[6px] font-bold text-gray-400 uppercase tracking-widest">{totalLabel}</span>
                <span className="text-sm font-black text-gray-900 dark:text-white">{total}</span>
            </div>
        </div>
    );
};

// --- Interactive Drag & Resize Wrapper ---
const InteractiveWrapper = ({ el, slideId, isSelected, onSelect, onUpdate, onAddRow, onAddColumn, onDeleteRow, onDeleteColumn, canvasRef, children }) => {
    const handleMouseDown = (e) => {
        if (e.target.closest('[contentEditable]')) {
            onSelect(el.id);
            return;
        }
        e.stopPropagation();
        onSelect(el.id);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const canvasRect = canvas.getBoundingClientRect();
        const startXPercent = parseFloat(el.x) || 0;
        const startYPercent = parseFloat(el.y) || 0;
        const startClientX = e.clientX;
        const startClientY = e.clientY;

        const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startClientX;
            const deltaY = moveEvent.clientY - startClientY;
            const newX = startXPercent + (deltaX / canvasRect.width) * 100;
            const newY = startYPercent + (deltaY / canvasRect.height) * 100;
            onUpdate(slideId, el.id, { x: `${newX}%`, y: `${newY}%` });
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleResizeMouseDown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        onSelect(el.id);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const canvasRect = canvas.getBoundingClientRect();
        const startWPercent = parseFloat(el.w) || 10;
        const startHPercent = el.h
            ? (parseFloat(el.h) || 10)
            : (e.currentTarget.parentElement.getBoundingClientRect().height / canvasRect.height) * 100;
        const startClientX = e.clientX;
        const startClientY = e.clientY;

        const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startClientX;
            const deltaY = moveEvent.clientY - startClientY;
            const newW = startWPercent + (deltaX / canvasRect.width) * 100;
            const newH = startHPercent + (deltaY / canvasRect.height) * 100;
            onUpdate(slideId, el.id, { w: `${Math.max(5, newW)}%`, h: `${Math.max(5, newH)}%` });
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Calculate dynamic scaling for tables to prevent overflow
    let scale = 1;
    if (el.type === 'progression_matrix' || el.type.includes('table')) {
        let baseRows = 6, baseCols = 6, currentRows = 1, currentCols = 1;

        if (el.type === 'progression_matrix') {
            currentRows = el.data.items?.length || 1;
            currentCols = el.data.weeks?.length || 1;
            baseRows = 5;
            baseCols = 4;
        } else {
            currentRows = el.data?.length || 1;
            currentCols = el.headers?.length || 1;
            baseRows = {
                'directory_table': 4,
                'variance_table': 6,
                'labour_table': 4,
                'material_table': 4,
                'execution_table': 6
            }[el.type] || 5;
            baseCols = {
                'directory_table': 4,
                'variance_table': 5,
                'labour_table': 4,
                'material_table': 4,
                'execution_table': 7
            }[el.type] || 5;
        }

        const scaleY = currentRows > baseRows ? baseRows / currentRows : 1;
        const scaleX = currentCols > baseCols ? baseCols / currentCols : 1;
        scale = Math.min(scaleX, scaleY);
    }

    // Adjust table vertical placement to avoid overlapping header/footer images
    const lastAdjustedTop = React.useRef(null);
    const myWrapperRef = React.useRef(null);
    React.useEffect(() => {
        if (!canvasRef?.current || !myWrapperRef.current) return;
        if (!(el.type === 'progression_matrix' || el.type.includes('table') || el.type === 'roadmap' || el.type === 'qaqc_audit')) return;

        // If 'y' was corrupted to NaN due to a previous crash, forcefully reset it
        if (typeof el.y === 'string' && el.y.includes('NaN')) {
            onUpdate(slideId, el.id, { y: '25%' });
            return;
        }

        const runCollisionEngine = () => {
            try {
                const slideContainer = myWrapperRef.current.closest('.absolute.inset-0.w-full.h-full') || canvasRef.current;
                const canvasRect = slideContainer.getBoundingClientRect();
                const wrapperRect = myWrapperRef.current.getBoundingClientRect();
                
                // Prevent NaN cascade if slide is hidden or unmounted
                if (canvasRect.height === 0 || wrapperRect.height === 0) return;

                const elHeightPx = wrapperRect.height;
                const headerImg = slideContainer.querySelector('img[alt="Header"]');
                const footerImg = slideContainer.querySelector('img[alt="Footer"]');
                const marginPx = 16;

                // Absolute bounding calculations relative to canvas
                let usableBottomLimit = canvasRect.height - marginPx;
                if (footerImg) {
                    const footerWrapper = footerImg.closest('.absolute') || footerImg;
                    const footerRect = footerWrapper.getBoundingClientRect();
                    if (footerRect.height > 0) {
                        usableBottomLimit = footerRect.top - canvasRect.top - marginPx;
                    }
                }

                let usableTopLimit = canvasRect.height * 0.30;
                if (headerImg) {
                    const headerWrapper = headerImg.closest('.absolute') || headerImg;
                    const headerRect = headerWrapper.getBoundingClientRect();
                    if (headerRect.height > 0) {
                        const headerBottom = headerRect.bottom - canvasRect.top + marginPx;
                        usableTopLimit = Math.max(usableTopLimit, headerBottom);
                    }
                }

                // If el.y is already in pixels, convert to number
                let currentTopPx = 0;
                if (typeof el.y === 'string' && el.y.includes('%')) {
                    currentTopPx = (parseFloat(el.y.replace('%', '')) / 100) * canvasRect.height;
                } else {
                    currentTopPx = parseFloat(el.y) || 0;
                }

                let newTopPx = currentTopPx;
                if (currentTopPx + elHeightPx > usableBottomLimit) {
                    newTopPx = Math.max(usableTopLimit, usableBottomLimit - elHeightPx);
                }
                if (newTopPx < usableTopLimit) newTopPx = usableTopLimit;

                const newTopPct = (newTopPx / canvasRect.height) * 100;
                if (isNaN(newTopPct) || !isFinite(newTopPct)) return;

                if (lastAdjustedTop.current === null || Math.abs(lastAdjustedTop.current - newTopPct) > 0.5) {
                    lastAdjustedTop.current = newTopPct;
                    onUpdate(slideId, el.id, { y: `${newTopPct.toFixed(2)}%` });
                }
            } catch (err) {
                // Silently continue
            }
        };

        // Run once on mount/update
        const timerId = setTimeout(runCollisionEngine, 50);

        // Also run whenever the element's actual physical DOM height changes (e.g., text wrapping, images loading)
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(runCollisionEngine);
        });
        resizeObserver.observe(myWrapperRef.current);

        return () => {
            clearTimeout(timerId);
            resizeObserver.disconnect();
        };
    }, [canvasRef, el, scale, onUpdate, slideId]);

    return (
        <div
            ref={myWrapperRef}
            className={`absolute ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-[#0d1117] z-[100] cursor-move' : 'z-30'}`}
            style={{
                left: el.x,
                top: el.y,
                width: scale < 1 ? `calc(${el.w} / ${scale})` : el.w,
                height: el.h ? (scale < 1 ? `calc(${el.h} / ${scale})` : el.h) : 'auto',
                transform: scale < 1 ? `scale(${scale})` : undefined,
                transformOrigin: 'top left'
            }}
            onMouseDown={handleMouseDown}
            onClick={(e) => e.stopPropagation()}
        >
            {React.cloneElement(children, {
                className: `${(children.props.className || '').replace('absolute', '')} relative w-full`,
                style: { ...children.props.style, left: 'auto', top: 'auto', width: '100%', height: el.h ? '100%' : (children.props.style?.height || 'auto') }
            })}

            {isSelected && (
                <>
                    <div
                        className="absolute -right-2 -bottom-2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-se-resize shadow-md z-[110]"
                        onMouseDown={handleResizeMouseDown}
                    />
                    {el.type === 'text' && (
                        <div className="absolute -top-10 left-0 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-lg rounded-lg p-1 flex space-x-1 z-[120]">
                            {/* Drag Handle */}
                            <div className="px-2 py-1 cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center justify-center" title="Drag to Move">
                                <GripHorizontal size={14} />
                            </div>
                        </div>
                    )}
                    {(el.type.includes('table') || el.type === 'progression_matrix') && (
                        <div className="absolute -top-10 left-0 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-lg rounded-lg p-1 flex space-x-1 z-[120]">
                            {/* Drag Handle */}
                            <div className="px-2 py-1 cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center justify-center border-r border-gray-200 dark:border-white/10" title="Drag to Move">
                                <GripHorizontal size={14} />
                            </div>
                            <button onMouseDown={(e) => { e.stopPropagation(); onAddRow(slideId, el.id); }} className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-[10px] font-bold text-gray-700 dark:text-gray-300 transition-colors flex items-center space-x-1">
                                <Plus size={12} /><span>Add Row</span>
                            </button>
                            <button onMouseDown={(e) => { e.stopPropagation(); onDeleteRow(slideId, el.id); }} className="px-2 py-1 hover:bg-rose-100 dark:hover:bg-rose-500/10 rounded text-[10px] font-bold text-rose-600 transition-colors flex items-center space-x-1">
                                <Minus size={12} /><span>Del Row</span>
                            </button>
                            <button onMouseDown={(e) => { e.stopPropagation(); onAddColumn(slideId, el.id); }} className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-[10px] font-bold text-gray-700 dark:text-gray-300 transition-colors flex items-center space-x-1">
                                <Plus size={12} /><span>Add Col</span>
                            </button>
                            <button onMouseDown={(e) => { e.stopPropagation(); onDeleteColumn(slideId, el.id); }} className="px-2 py-1 hover:bg-rose-100 dark:hover:bg-rose-500/10 rounded text-[10px] font-bold text-rose-600 transition-colors flex items-center space-x-1">
                                <Minus size={12} /><span>Del Col</span>
                            </button>
                        </div>
                    )}
                    {el.type === 'chart' && (
                        <div className="absolute -top-10 left-0 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-lg rounded-lg p-1 flex space-x-1 z-[120]">
                            {/* Drag Handle */}
                            <div className="px-2 py-1 cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center justify-center border-r border-gray-200 dark:border-white/10" title="Drag to Move">
                                <GripHorizontal size={14} />
                            </div>
                            <button onMouseDown={(e) => { e.stopPropagation(); onUpdate(slideId, el.id, { chartType: 'donut' }); }} className={`px-2 py-1 rounded text-[10px] font-bold transition-colors flex items-center space-x-1 ${el.chartType !== 'pie' && el.chartType !== 'bar' && el.chartType !== 'line' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}>
                                <PieChart size={12} /><span>Donut</span>
                            </button>
                            <button onMouseDown={(e) => { e.stopPropagation(); onUpdate(slideId, el.id, { chartType: 'pie' }); }} className={`px-2 py-1 rounded text-[10px] font-bold transition-colors flex items-center space-x-1 ${el.chartType === 'pie' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}>
                                <PieChart size={12} /><span>Pie</span>
                            </button>
                            <button onMouseDown={(e) => { e.stopPropagation(); onUpdate(slideId, el.id, { chartType: 'bar' }); }} className={`px-2 py-1 rounded text-[10px] font-bold transition-colors flex items-center space-x-1 ${el.chartType === 'bar' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}>
                                <BarChart2 size={12} /><span>Bar</span>
                            </button>
                            <button onMouseDown={(e) => { e.stopPropagation(); onUpdate(slideId, el.id, { chartType: 'line' }); }} className={`px-2 py-1 rounded text-[10px] font-bold transition-colors flex items-center space-x-1 ${el.chartType === 'line' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}>
                                <LineChart size={12} /><span>Line</span>
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const THEMES = [
    {
        id: 'light',
        name: 'Premium Light',
        dark: false,
        canvasStyle: { background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' },
        textPrimary: '#0f172a',
        textMuted: '#64748b',
        previewColors: ['#f8fafc', '#e2e8f0']
    },
    {
        id: 'dark',
        name: 'Slate Night',
        dark: true,
        canvasStyle: { background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
        textPrimary: '#ffffff',
        textMuted: '#9ca3af',
        previewColors: ['#1e293b', '#0f172a']
    },
    {
        id: 'navy',
        name: 'Deep Ocean',
        dark: true,
        canvasStyle: { background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
        textPrimary: '#f8fafc',
        textMuted: '#94a3b8',
        previewColors: ['#0f2027', '#2c5364']
    },
    {
        id: 'forest',
        name: 'Emerald Forest',
        dark: true,
        canvasStyle: { background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)' },
        textPrimary: '#ecfdf5',
        textMuted: '#a7f3d0',
        previewColors: ['#064e3b', '#022c22']
    },
    {
        id: 'crimson',
        name: 'Crimson Executive',
        dark: true,
        canvasStyle: { background: 'linear-gradient(135deg, #450a0a 0%, #2a0800 100%)' },
        textPrimary: '#fff1f2',
        textMuted: '#fecdd3',
        previewColors: ['#450a0a', '#2a0800']
    },
    {
        id: 'sepia',
        name: 'Midnight Purple',
        dark: true,
        canvasStyle: { background: 'linear-gradient(135deg, #1e1b4b 0%, #000000 100%)' },
        textPrimary: '#ffffff',
        textMuted: '#a5b4fc',
        previewColors: ['#1e1b4b', '#000000']
    },
    {
        id: 'modern',
        name: 'Warm Sunset',
        dark: true,
        canvasStyle: { background: 'linear-gradient(135deg, #7c2d12 0%, #431407 100%)' },
        textPrimary: '#fff7ed',
        textMuted: '#fdba74',
        previewColors: ['#7c2d12', '#431407']
    }
];

const isBgDark = (hex) => {
    if (!hex) return false;
    const c = hex.substring(1);
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma < 128;
};

const PPTEditor = ({ reportData, onClose }) => {
    const [activeSlide, setActiveSlide] = useState(0);
    const [slideDirection, setSlideDirection] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [activeTheme, setActiveTheme] = useState(THEMES[1]);
    const [showThemePanel, setShowThemePanel] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [globalHeader, setGlobalHeader] = useState({ id: 'h1', type: 'image', url: '/assets/ppt-assets/header.png', x: '2%', y: '2%', w: '25%', h: 'auto' });
    const [globalFooter, setGlobalFooter] = useState({ id: 'f1', type: 'image', url: '/assets/ppt-assets/footer.png', x: '68%', y: '88%', w: '30%', h: 'auto' });
    const canvasRef = useRef(null);

    // Slide Management States
    const [draggedSlideIdx, setDraggedSlideIdx] = useState(null);
    const [dragOverIdx, setDragOverIdx] = useState(null);
    const wheelTimeout = useRef(null);

    // Floating Rich Text Toolbar State
    const [toolbarPosition, setToolbarPosition] = useState(null);

    React.useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                const node = selection.anchorNode;
                if (!node) return;

                const element = node.nodeType === 3 ? node.parentElement : node;

                if (element && typeof element.closest === 'function') {
                    // Check for contenteditable attribute (presence of attribute is enough)
                    const isEditable = element.closest('[contenteditable]');

                    if (isEditable) {
                        const range = selection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        setToolbarPosition({
                            x: rect.left + rect.width / 2,
                            y: rect.top - 40
                        });
                        return;
                    }
                }
            }
            setToolbarPosition(null);
        };
        document.addEventListener('selectionchange', handleSelection);
        return () => document.removeEventListener('selectionchange', handleSelection);
    }, []);

    const execCommand = (command, value = null) => {
        document.execCommand(command, false, value);
    };

    const handleWheel = (e) => {
        // Debounce slide changes
        if (wheelTimeout.current) return;
        
        // Prevent sliding if scrolling inside the notes textarea
        if (e.target.tagName === 'TEXTAREA') return;

        if (e.deltaY > 50) {
            setActiveSlide(prev => {
                if (prev < slides.length - 1) setSlideDirection(1);
                return Math.min(prev + 1, slides.length - 1);
            });
            wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null; }, 500);
        } else if (e.deltaY < -50) {
            setActiveSlide(prev => {
                if (prev > 0) setSlideDirection(-1);
                return Math.max(prev - 1, 0);
            });
            wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null; }, 500);
        }
    };

    // Slide Management Handlers
    const handleDragStart = (idx) => setDraggedSlideIdx(idx);
    const handleDragOver = (e, idx) => {
        e.preventDefault();
        setDragOverIdx(idx);
    };
    const handleDragLeave = () => setDragOverIdx(null);
    const handleDrop = (e, idx) => {
        e.preventDefault();
        if (draggedSlideIdx === null || draggedSlideIdx === idx) {
            setDragOverIdx(null);
            return;
        }
        const newSlides = [...slides];
        const [moved] = newSlides.splice(draggedSlideIdx, 1);
        newSlides.splice(idx, 0, moved);
        setSlides(newSlides);
        if (activeSlide === draggedSlideIdx) setActiveSlide(idx);
        else if (activeSlide > draggedSlideIdx && activeSlide <= idx) setActiveSlide(activeSlide - 1);
        else if (activeSlide < draggedSlideIdx && activeSlide >= idx) setActiveSlide(activeSlide + 1);
        setDraggedSlideIdx(null);
        setDragOverIdx(null);
    };

    const handleDuplicateSlide = (e, slide, idx) => {
        e.stopPropagation();
        const newSlide = { ...slide, id: Date.now(), title: `${slide.title || 'Slide'} (Copy)` };
        const newSlides = [...slides];
        newSlides.splice(idx + 1, 0, newSlide);
        setSlides(newSlides);
    };

    const handleDeleteSlide = (e, idx) => {
        e.stopPropagation();
        if (slides.length <= 1) return;
        const newSlides = slides.filter((_, i) => i !== idx);
        setSlides(newSlides);
        if (activeSlide === idx) setActiveSlide(Math.max(0, idx - 1));
        else if (activeSlide > idx) setActiveSlide(activeSlide - 1);
    };

    const handleToggleHideSlide = (e, idx) => {
        e.stopPropagation();
        const newSlides = [...slides];
        newSlides[idx] = { ...newSlides[idx], isHidden: !newSlides[idx].isHidden };
        setSlides(newSlides);
    };

    const handleUpdateSlideBackground = (color) => {
        const newSlides = [...slides];
        newSlides[activeSlide] = { ...newSlides[activeSlide], background: color };
        setSlides(newSlides);
    };

    const handleAddTextElement = () => {
        const newElement = {
            id: `text_${Date.now()}`,
            type: 'text',
            content: 'New Text Box',
            style: 'text-2xl font-medium text-gray-900 dark:text-white',
            x: '50%', y: '50%', w: '40%'
        };
        const newSlides = [...slides];
        newSlides[activeSlide].elements.push(newElement);
        setSlides(newSlides);
        setSelectedElementId(newElement.id);
    };

    const handleAddImageElement = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const newElement = {
                        id: `img_${Date.now()}`,
                        type: 'image',
                        url: ev.target.result,
                        x: '30%', y: '30%', w: '40%', h: 'auto'
                    };
                    const newSlides = [...slides];
                    newSlides[activeSlide].elements.push(newElement);
                    setSlides(newSlides);
                    setSelectedElementId(newElement.id);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleAddSlide = () => {
        const newSlide = {
            id: Date.now(),
            type: 'content',
            title: 'New Blank Slide',
            elements: [
                { id: `title_${Date.now()}`, type: 'text', content: 'New Blank Slide', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '10%', y: '10%', w: '80%' }
            ]
        };
        setSlides([...slides, newSlide]);
        setActiveSlide(slides.length);
    };

    const handleTableEdit = (slideId, elId, rowIndex, field, value) => {
        setSlides(prev => prev.map(slide => {
            if (slide.id !== slideId) return slide;
            return {
                ...slide,
                elements: slide.elements.map(el => {
                    if (el.id !== elId) return el;

                    if (el.type === 'progression_matrix') {
                        const newData = { ...el.data };
                        if (field.startsWith('week_')) {
                            const weekIdx = parseInt(field.split('_')[1]);
                            newData.items[rowIndex].weeklyBreakdown[weekIdx] = value;
                        } else {
                            newData.items[rowIndex][field] = value;
                        }
                        return { ...el, data: newData };
                    }

                    const newData = [...el.data];
                    newData[rowIndex] = { ...newData[rowIndex], [field]: value };
                    return { ...el, data: newData };
                })
            };
        }));
    };

    const handleHeaderEdit = (slideId, elId, colIndex, value) => {
        setSlides(prev => prev.map(slide => {
            if (slide.id !== slideId) return slide;
            return {
                ...slide,
                elements: slide.elements.map(el => {
                    if (el.id !== elId) return el;
                    if (el.type === 'progression_matrix') {
                        const newData = { ...el.data };
                        newData.weeks[colIndex].week = value;
                        return { ...el, data: newData };
                    }
                    const newHeaders = [...el.headers];
                    newHeaders[colIndex] = value;
                    return { ...el, headers: newHeaders };
                })
            };
        }));
    };

    const handleChartEdit = (slideId, elId, index, field, value) => {
        setSlides(prev => prev.map(slide => {
            if (slide.id !== slideId) return slide;
            return {
                ...slide,
                elements: slide.elements.map(el => {
                    if (el.id !== elId) return el;
                    const newChartData = [...el.chartData];
                    // Create a true new object for React to detect the change
                    newChartData[index] = { ...newChartData[index] };

                    if (field === 'value') {
                        // Extract number from formatted string "₹5.20L" -> 5.20 * 100000
                        const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
                        newChartData[index].value = isNaN(parsed) ? 0 : parsed * 100000;
                    } else {
                        newChartData[index][field] = value;
                    }
                    return { ...el, chartData: newChartData };
                })
            };
        }));
    };

    const handleAddRow = (slideId, elId) => {
        setSlides(prev => prev.map(slide => {
            if (slide.id !== slideId) return slide;
            return {
                ...slide,
                elements: slide.elements.map(el => {
                    if (el.id !== elId) return el;

                    if (el.type === 'directory_table') {
                        return { ...el, data: [...el.data, { role: 'New Role', name: 'New Name', company: 'New Company', contact: 'New Contact' }] };
                    }
                    if (el.type === 'progression_matrix') {
                        const newItems = [...el.data.items, { task: 'New Task', unit: 'unit', weeklyBreakdown: Array(el.data.weeks.length).fill(0), executedQty: 0 }];
                        return { ...el, data: { ...el.data, items: newItems } };
                    }
                    if (el.type === 'variance_table') {
                        return { ...el, data: [...el.data, { task: 'New Task', plannedQty: 0, executedQty: 0, variance: 0, unit: 'unit' }] };
                    }
                    if (el.type === 'labour_table' || el.type === 'material_table') {
                        return { ...el, data: [...el.data, { week: 'New Week', labour: [], materials: [] }] };
                    }
                    if (el.type === 'execution_table') {
                        return { ...el, data: [...el.data, { task: 'New Task', duration: '0 Days', completionPercentage: 0, plannedStart: 'Date', actualStart: 'Date', plannedEnd: 'Date', actualEnd: 'Date' }] };
                    }
                    return el;
                })
            };
        }));
    };

    const handleAddColumn = (slideId, elId) => {
        setSlides(prev => prev.map(slide => {
            if (slide.id !== slideId) return slide;
            return {
                ...slide,
                elements: slide.elements.map(el => {
                    if (el.id !== elId) return el;
                    if (el.type === 'progression_matrix') {
                        const newWeeks = [...el.data.weeks, { week: `Week ${el.data.weeks.length + 1}` }];
                        const newItems = el.data.items.map(item => ({
                            ...item,
                            weeklyBreakdown: [...item.weeklyBreakdown, 0]
                        }));
                        return { ...el, data: { ...el.data, weeks: newWeeks, items: newItems } };
                    }
                    if (el.type.includes('table')) {
                        const newHeaders = [...el.headers, 'New Column'];
                        return { ...el, headers: newHeaders };
                    }
                    return el;
                })
            };
        }));
    };

    const handleDeleteRow = (slideId, elId) => {
        setSlides(prev => prev.map(slide => {
            if (slide.id !== slideId) return slide;
            return {
                ...slide,
                elements: slide.elements.map(el => {
                    if (el.id !== elId) return el;
                    if (el.type === 'progression_matrix') {
                        if (el.data.items.length <= 1) return el;
                        const newItems = el.data.items.slice(0, -1);
                        return { ...el, data: { ...el.data, items: newItems } };
                    }
                    if (el.type.includes('table')) {
                        if (el.data.length <= 1) return el;
                        const newData = el.data.slice(0, -1);
                        return { ...el, data: newData };
                    }
                    return el;
                })
            };
        }));
    };

    const handleDeleteColumn = (slideId, elId) => {
        setSlides(prev => prev.map(slide => {
            if (slide.id !== slideId) return slide;
            return {
                ...slide,
                elements: slide.elements.map(el => {
                    if (el.id !== elId) return el;
                    if (el.type === 'progression_matrix') {
                        if (el.data.weeks.length <= 1) return el;
                        const newWeeks = el.data.weeks.slice(0, -1);
                        const newItems = el.data.items.map(item => ({
                            ...item,
                            weeklyBreakdown: item.weeklyBreakdown.slice(0, -1)
                        }));
                        return { ...el, data: { ...el.data, weeks: newWeeks, items: newItems } };
                    }
                    if (el.type.includes('table')) {
                        const baseLengths = {
                            'directory_table': 4,
                            'variance_table': 5,
                            'labour_table': 4,
                            'material_table': 4,
                            'execution_table': 7
                        };
                        const minLength = baseLengths[el.type] || 1;
                        if (el.headers.length <= minLength) return el; // Prevent deleting core format columns
                        const newHeaders = el.headers.slice(0, -1);
                        return { ...el, headers: newHeaders };
                    }
                    return el;
                })
            };
        }));
    };

    // Process chart data
    const labourMap = {};
    const materialMap = {};
    reportData.weeks.forEach(w => {
        w.labour.forEach(l => {
            if (!labourMap[l.trade]) labourMap[l.trade] = { value: 0, color: l.color };
            labourMap[l.trade].value += l.actual;
        });
        w.materials.forEach(m => {
            if (!materialMap[m.item]) materialMap[m.item] = { value: 0, color: m.color };
            materialMap[m.item].value += m.actual;
        });
    });
    const labourChartData = Object.entries(labourMap).map(([label, info]) => ({ label, ...info }));
    const materialChartData = Object.entries(materialMap).map(([label, info]) => ({ label, ...info }));

    const [slides, setSlides] = useState(() => [
        {
            id: 1, type: 'title', title: reportData.projectName || 'Project Name', elements: [
                { id: 'e1', type: 'text', content: reportData.projectName, style: 'text-6xl font-black text-center text-gray-900 dark:text-white', x: '50%', y: '50%', transform: 'translate(-50%, -50%)', w: '80%' }
            ]
        },
        {
            id: 2, type: 'header', title: 'Monthly Report', elements: [
                { id: 'e2', type: 'text', content: 'Monthly Executive Report', style: 'text-4xl font-black text-blue-500 text-center', x: '10%', y: '35%', w: '80%' },
                { id: 'e3', type: 'text', content: reportData.month, style: 'text-2xl font-medium text-gray-500 dark:text-gray-400 text-center', x: '10%', y: '50%', w: '80%' }
            ]
        },
        {
            id: 3, type: 'table', title: 'Project Directory', elements: [
                { id: 'e4_title', type: 'text', content: 'Project Directory', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                {
                    id: 'e4', type: 'directory_table', headers: ['Role', 'Name', 'Company', 'Contact'], data: [
                        { role: 'Project Manager', name: 'John Doe', company: 'BuildCorp', contact: '+91 9876543210' },
                        { role: 'Site Engineer', name: 'Jane Smith', company: 'BuildCorp', contact: '+91 8765432109' },
                        { role: 'Safety Officer', name: 'Mike Ross', company: 'SafeSite', contact: '+91 7654321098' }
                    ], x: '10%', y: '25%', w: '80%'
                }
            ]
        },
        {
            id: 4, type: 'content', title: 'Overall Progress: Weekly Progression Matrix', elements: [
                { id: 'e5_title', type: 'text', content: 'Overall Progress: Weekly Progression Matrix', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e5', type: 'progression_matrix', data: reportData, x: '5%', y: '25%', w: '90%' }
            ]
        },
        {
            id: 5, type: 'content', title: 'Overall Progress: Monthly Variance', elements: [
                { id: 'e6_title', type: 'text', content: 'Overall Progress: Monthly Variance', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e6', type: 'variance_table', headers: ['Task Activity', 'Planned', 'Actual', 'Variance', 'Status'], data: reportData.items, x: '5%', y: '25%', w: '90%' }
            ]
        },
        {
            id: 6, type: 'chart_slide', title: 'Monthly Labour Distribution', elements: [
                { id: 'e7_title', type: 'text', content: 'LABOUR DISTRIBUTION', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e7', type: 'chart', chartData: labourChartData, title: '', x: '15%', y: '22%', w: '70%' }
            ]
        },
        {
            id: 7, type: 'content', title: 'Weekly Labour Expenditure', elements: [
                { id: 'e8_title', type: 'text', content: 'Weekly Labour Expenditure', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e8', type: 'labour_table', headers: ['Time Period', 'Predicted Cost', 'Actual Cost', 'Variance'], data: reportData.weeks, x: '10%', y: '25%', w: '80%' }
            ]
        },
        {
            id: 8, type: 'chart_slide', title: 'Monthly Material Consumption', elements: [
                { id: 'e9_title', type: 'text', content: 'MATERIAL CONSUMPTION', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e9', type: 'chart', chartData: materialChartData, title: '', x: '15%', y: '22%', w: '70%' }
            ]
        },
        {
            id: 9, type: 'content', title: 'Weekly Material Consumption', elements: [
                { id: 'e10_title', type: 'text', content: 'Weekly Material Consumption', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e10', type: 'material_table', headers: ['Time Period', 'Predicted Cost', 'Actual Cost', 'Variance'], data: reportData.weeks, x: '10%', y: '25%', w: '80%' }
            ]
        },
        {
            id: 10, type: 'content', title: 'Monthly Execution Timeline', elements: [
                { id: 'e11_title', type: 'text', content: 'Monthly Execution Timeline', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e11', type: 'execution_table', headers: ['Task Name', 'Duration', '% Done', 'Planned Start', 'Actual Start', 'Planned End', 'Actual End'], data: reportData.items, x: '5%', y: '25%', w: '90%' }
            ]
        },
        {
            id: 11, type: 'image_upload', title: 'Site Progress - View 1', elements: [
                { id: 'e12_title', type: 'text', content: 'Site Progress - View 1', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e12', type: 'upload_zone', x: '20%', y: '25%', w: '60%', h: '55%' }
            ]
        },
        {
            id: 12, type: 'image_upload', title: 'Site Progress - View 2', elements: [
                { id: 'e13_title', type: 'text', content: 'Site Progress - View 2', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e13', type: 'upload_zone', x: '20%', y: '25%', w: '60%', h: '55%' }
            ]
        },
        {
            id: 13, type: 'image_upload', title: 'Site Progress - View 3', elements: [
                { id: 'e14_title', type: 'text', content: 'Site Progress - View 3', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e14', type: 'upload_zone', x: '20%', y: '25%', w: '60%', h: '55%' }
            ]
        },
        {
            id: 14, type: 'content', title: 'Quality Assurance Audit', elements: [
                { id: 'e15_title', type: 'text', content: 'Quality Assurance Audit', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e15', type: 'qaqc_audit', data: reportData.qaqc, x: '10%', y: '25%', w: '80%' }
            ]
        },
        {
            id: 15, type: 'content', title: 'Strategic Roadmap (Upcoming Month)', elements: [
                { id: 'e16_title', type: 'text', content: 'Strategic Roadmap (Upcoming Month)', style: 'text-xl lg:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight text-center', x: '18%', y: '16%', w: '64%' },
                { id: 'e16', type: 'roadmap', data: reportData.stats.strategicPlans, x: '10%', y: '25%', w: '80%' }
            ]
        }
    ]);

    React.useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if user is typing in an input, textarea, or contentEditable
            if (
                e.target.tagName.toLowerCase() === 'input' || 
                e.target.tagName.toLowerCase() === 'textarea' || 
                e.target.isContentEditable
            ) {
                return;
            }

            if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
            
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
                if (e.key === ' ') e.preventDefault(); // prevent page scroll
                setActiveSlide(prev => {
                    if (prev < slides.length - 1) setSlideDirection(1);
                    return Math.min(prev + 1, slides.length - 1);
                });
            }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                setActiveSlide(prev => {
                    if (prev > 0) setSlideDirection(-1);
                    return Math.max(prev - 1, 0);
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen, slides.length]);

    const handleUpdateElement = (slideId, elId, updates) => {
        setSlides(prev => prev.map(slide => {
            if (slide.id !== slideId) return slide;

            let updatedTitle = slide.title;
            if (updates.content !== undefined && (elId.endsWith('_title') || elId === 'e1' || elId === 'e2')) {
                updatedTitle = updates.content.replace(/<[^>]*>/g, '').trim() || slide.title;
            }

            return {
                ...slide,
                title: updatedTitle,
                elements: slide.elements.map(el => el.id === elId ? { ...el, ...updates } : el)
            };
        }));
    };

    const renderElement = (slide, el) => {
        if (el.type === 'text') {
            return (
                <div key={el.id} className={`absolute ${el.style} outline-none`} style={{ left: el.x, top: el.y, transform: el.transform, width: el.w }} contentEditable suppressContentEditableWarning onBlur={(e) => handleUpdateElement(slide.id, el.id, { content: e.target.innerHTML })} dangerouslySetInnerHTML={{ __html: el.content || '' }} />
            );
        }

        if (el.type === 'directory_table') {
            return (
                <div key={el.id} className="absolute bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg" style={{ left: el.x, top: el.y, width: el.w }}>
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-gray-50 dark:bg-white/5 font-black uppercase tracking-widest text-gray-500">
                            <tr>
                                {el.headers?.map((h, i) => <th key={i} className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleHeaderEdit(slide.id, el.id, i, e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: h || '' }} />)}
                            </tr>
                        </thead>
                        <tbody className="text-gray-800 dark:text-gray-200 font-medium">
                            {el.data.map((row, i) => (
                                <tr key={i}>
                                    <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, i, 'role', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: row.role || '' }} />
                                    <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, i, 'name', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: row.name || '' }} />
                                    <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, i, 'company', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: row.company || '' }} />
                                    <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, i, 'contact', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: row.contact || '' }} />
                                    {el.headers.length > 4 && el.headers.slice(4).map((_, cIdx) => (
                                        <td key={cIdx} className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, i, `dynamic_${cIdx}`, e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: row[`dynamic_${cIdx}`] || '' }} />
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (el.type === 'progression_matrix') {
            return (
                <div key={el.id} className="absolute flex flex-col" style={{ left: el.x, top: el.y, width: el.w }}>

                    {/* Full Weekly Breakdown Table */}
                    <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-gray-50 dark:bg-white/5">
                                <tr>
                                    <th className="border border-gray-300 dark:border-white/20 resize overflow-auto px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Construction Task</th>
                                    {el.data.weeks.map((w, idx) => (
                                        <th key={idx} className="border border-gray-300 dark:border-white/20 resize overflow-auto px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleHeaderEdit(slide.id, el.id, idx, e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: w.week || '' }} />
                                    ))}
                                    <th className="border border-gray-300 dark:border-white/20 resize overflow-auto px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {el.data.items.map((item, idx) => (
                                    <tr key={idx} className="text-gray-800 dark:text-gray-200">
                                        <td className="border border-gray-300 dark:border-white/20 resize overflow-auto px-3 py-2">
                                            <div className="flex items-center space-x-2">
                                                <span className="font-bold text-gray-900 dark:text-white text-[11px] leading-tight outline-none w-full" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'task', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item.task || '' }} />
                                                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-[9px] font-bold text-gray-400 uppercase outline-none shrink-0" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'unit', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item.unit || '' }} />
                                            </div>
                                        </td>
                                        {item.weeklyBreakdown.map((qty, qIdx) => (
                                            <td key={qIdx} className="border border-gray-300 dark:border-white/20 resize overflow-auto px-3 py-2 text-center font-black text-gray-600 dark:text-gray-400 text-[11px] outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, `week_${qIdx}`, parseFloat(e.target.innerText) || 0)}>{qty}</td>
                                        ))}
                                        <td className="border border-gray-300 dark:border-white/20 resize overflow-auto px-3 py-2 text-right font-black text-blue-600 text-[11px] outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'executedQty', parseFloat(e.target.innerText) || 0)}>{item.executedQty}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        if (el.type === 'variance_table') {
            return (
                <div key={el.id} className="absolute bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg" style={{ left: el.x, top: el.y, width: el.w }}>
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-gray-50 dark:bg-white/5 font-black uppercase tracking-widest text-gray-500">
                            <tr>
                                {el.headers?.map((h, i) => <th key={i} className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleHeaderEdit(slide.id, el.id, i, e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: h || '' }} />)}
                            </tr>
                        </thead>
                        <tbody className="text-gray-800 dark:text-gray-200 font-medium">
                            {el.data.map((item, idx) => {
                                const isAhead = parseFloat(item.variance) >= 0;
                                return (
                                    <tr key={idx}>
                                        <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto font-bold text-sm outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'task', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item.task || '' }} />
                                        <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto text-center text-gray-500 text-sm outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'plannedQty', parseFloat(e.target.innerText) || 0)}>{item.plannedQty} {item.unit}</td>
                                        <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto text-center font-bold text-sm outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'executedQty', parseFloat(e.target.innerText) || 0)}>{item.executedQty} {item.unit}</td>
                                        <td className={`p-4 border border-gray-300 dark:border-white/20 resize overflow-auto text-center font-bold text-sm outline-none ${isAhead ? 'text-emerald-500' : 'text-rose-500'}`} contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'variance', parseFloat(e.target.innerText) || 0)}>{isAhead ? '+' : ''}{item.variance}%</td>
                                        <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter outline-none ${isAhead ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`} contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: isAhead ? 'On Track' : 'Delayed' }} />
                                        </td>
                                        {el.headers.length > 5 && el.headers.slice(5).map((_, cIdx) => (
                                            <td key={cIdx} className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto text-center font-bold text-sm outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, `dynamic_${cIdx}`, e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item[`dynamic_${cIdx}`] || '' }} />
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (el.type === 'chart') {
            const chartTotal = el.chartData.reduce((s, d) => s + d.value, 0);
            const cType = el.chartType || 'donut';

            // Pre-calculate midpoints for labels on slices (Pie/Donut)
            let labelCum = 0;
            const sliceLabels = el.chartData.map(d => {
                const pct = chartTotal ? d.value / chartTotal : 0;
                const mid = labelCum + pct / 2;
                labelCum += pct;
                const angle = 2 * Math.PI * mid - Math.PI / 2;
                const lx = Math.cos(angle) * 1.3;
                const ly = Math.sin(angle) * 1.3;
                return { ...d, pct, lx, ly };
            });

            // For Bar/Line Charts
            const maxValue = Math.max(...el.chartData.map(d => d.value), 1);

            return (
                <div key={el.id} className="absolute flex flex-row items-stretch justify-between" style={{ left: el.x, top: el.y, width: el.w, bottom: '8%' }}>
                    {/* Expanded Labels — LEFT side (Flow layout to guarantee no overlap) */}
                    <div className="w-[38%] space-y-2 pr-6 flex flex-col justify-center">
                        <h5 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-3">{el.title}</h5>
                        {el.chartData.map((d, i) => (
                            <div key={i} className="flex items-center gap-2.5 py-2 px-3 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-md">
                                <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-inner" style={{ backgroundColor: d.color }} />
                                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase truncate outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleChartEdit(slide.id, el.id, i, 'label', e.target.innerText)} dangerouslySetInnerHTML={{ __html: d.label }}></span>
                                <span className="text-sm font-black text-gray-900 dark:text-white whitespace-nowrap ml-auto outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleChartEdit(slide.id, el.id, i, 'value', e.target.innerText)} dangerouslySetInnerHTML={{ __html: `₹${(d.value / 100000).toFixed(2)}L` }}></span>
                            </div>
                        ))}
                    </div>
                    {/* Chart Area — CENTERED in the remaining space */}
                    <div className="flex-1 flex items-center justify-center relative">
                        {cType === 'donut' || cType === 'pie' ? (
                            <div className="relative" style={{ width: '100%', aspectRatio: '1' }}>
                                <svg viewBox="-2 -2 4 4" className="w-full h-full drop-shadow-xl overflow-visible">
                                    {(() => {
                                        let cum = 0;
                                        return el.chartData.map((slice, i) => {
                                            const start = cum;
                                            const pct = chartTotal ? slice.value / chartTotal : 0;
                                            cum += pct;
                                            if (pct === 0) return null;
                                            const a1 = 2 * Math.PI * start - Math.PI / 2;
                                            const a2 = 2 * Math.PI * cum - Math.PI / 2;
                                            const [sx, sy] = [Math.cos(a1), Math.sin(a1)];
                                            const [ex, ey] = [Math.cos(a2), Math.sin(a2)];
                                            const large = pct > 0.5 ? 1 : 0;
                                            // For Pie: M 0 0 L sx sy A 1 1 0 large 1 ex ey Z
                                            // For Donut: M sx sy A 1 1 0 large 1 ex ey L 0 0
                                            const pathD = cType === 'pie'
                                                ? `M 0 0 L ${sx} ${sy} A 1 1 0 ${large} 1 ${ex} ${ey} Z`
                                                : `M ${sx} ${sy} A 1 1 0 ${large} 1 ${ex} ${ey} L 0 0`;
                                            return <path key={i} d={pathD} fill={slice.color} className="opacity-90 hover:opacity-100 transition-opacity" />;
                                        });
                                    })()}
                                    {cType === 'donut' && <circle r="0.6" fill="currentColor" className="text-white dark:text-[#0d1117]" />}
                                    {/* Cost labels on each slice */}
                                    {sliceLabels.map((s, i) => (
                                        s.pct > 0.05 && (
                                            <text key={`lbl-${i}`} x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle" className="fill-black dark:fill-white pointer-events-none" style={{ fontSize: '0.16px', fontWeight: 900 }}>
                                                ₹{(s.value / 1000).toFixed(0)}k
                                            </text>
                                        )
                                    ))}
                                </svg>
                                {cType === 'donut' && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-[7px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">Total</span>
                                        <span className="text-lg font-black text-gray-900 dark:text-white">₹{(chartTotal / 100000).toFixed(2)}L</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="relative w-full h-[80%] flex items-end justify-between px-6 border-b-2 border-l-2 border-gray-200 dark:border-white/10 pt-8 pb-1">
                                {cType === 'line' && (
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                                        <polyline
                                            points={el.chartData.map((d, i) => `${(i + 0.5) * (100 / el.chartData.length)}, ${100 - (d.value / maxValue * 90)}`).join(' ')}
                                            fill="none"
                                            stroke="#3B82F6"
                                            strokeWidth="2"
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    </svg>
                                )}
                                {el.chartData.map((d, i) => {
                                    const heightPct = (d.value / maxValue) * 90;
                                    return (
                                        <div key={i} className="relative flex flex-col items-center flex-1 mx-1" style={{ height: '100%' }}>
                                            {cType === 'bar' && (
                                                <div
                                                    className="w-full max-w-[32px] absolute bottom-0 rounded-t-sm transition-all"
                                                    style={{ height: `${heightPct}%`, backgroundColor: d.color }}
                                                />
                                            )}
                                            {cType === 'line' && (
                                                <div
                                                    className="w-3 h-3 rounded-full border-2 border-white dark:border-[#0d1117] absolute z-10"
                                                    style={{ bottom: `calc(${heightPct}% - 6px)`, backgroundColor: d.color }}
                                                />
                                            )}
                                            <span className="absolute -bottom-6 text-[8px] font-bold text-gray-500 whitespace-nowrap truncate w-full text-center px-1">{d.label}</span>
                                            <span className="absolute text-[9px] font-black text-gray-700 dark:text-gray-300 whitespace-nowrap" style={{ bottom: `calc(${heightPct}% + 4px)` }}>₹{(d.value / 1000).toFixed(0)}k</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (el.type === 'labour_table' || el.type === 'material_table') {
            const isLabour = el.type === 'labour_table';
            return (
                <div key={el.id} className="absolute bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg" style={{ left: el.x, top: el.y, width: el.w }}>
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-gray-50 dark:bg-white/5 font-black uppercase tracking-widest text-gray-500">
                            <tr>
                                {el.headers?.map((h, i) => <th key={i} className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleHeaderEdit(slide.id, el.id, i, e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: h || '' }} />)}
                            </tr>
                        </thead>
                        <tbody className="text-gray-800 dark:text-gray-200 font-medium">
                            {el.data.map((week, idx) => {
                                const items = isLabour ? week.labour : week.materials;
                                const actual = items.reduce((s, i) => s + i.actual, 0);
                                const predicted = items.reduce((s, i) => s + i.predicted, 0);
                                const variance = (((actual - predicted) / predicted) * 100).toFixed(1);
                                return (
                                    <tr key={idx}>
                                        <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto font-bold uppercase text-sm outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'week', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: week.week || '' }} />
                                        <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto text-right text-gray-500 text-sm outline-none" contentEditable suppressContentEditableWarning>₹{(predicted / 1000).toFixed(1)}k</td>
                                        <td className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto text-right font-black text-sm outline-none" contentEditable suppressContentEditableWarning>₹{(actual / 1000).toFixed(1)}k</td>
                                        <td className={`p-4 border border-gray-300 dark:border-white/20 resize overflow-auto text-right font-black text-sm outline-none ${variance > 0 ? 'text-rose-500' : 'text-emerald-500'}`} contentEditable suppressContentEditableWarning>{variance > 0 ? '+' : ''}{variance}%</td>
                                        {el.headers.length > 4 && el.headers.slice(4).map((_, cIdx) => (
                                            <td key={cIdx} className="p-4 border border-gray-300 dark:border-white/20 resize overflow-auto text-right font-bold text-sm outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, `dynamic_${cIdx}`, e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: week[`dynamic_${cIdx}`] || '' }} />
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (el.type === 'execution_table') {
            return (
                <div key={el.id} className="absolute bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg" style={{ left: el.x, top: el.y, width: el.w }}>
                    <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-gray-50 dark:bg-white/5 font-black uppercase tracking-widest text-gray-500">
                            <tr>
                                {el.headers?.map((h, i) => <th key={i} className="px-3 py-2.5 border border-gray-300 dark:border-white/20 resize overflow-auto outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleHeaderEdit(slide.id, el.id, i, e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: h || '' }} />)}
                            </tr>
                        </thead>
                        <tbody className="text-gray-800 dark:text-gray-200 font-medium">
                            {el.data.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="px-3 py-2 border border-gray-300 dark:border-white/20 resize overflow-auto font-bold text-[11px] leading-tight outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'task', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item.task || '' }} />
                                    <td className="px-3 py-2 border border-gray-300 dark:border-white/20 resize overflow-auto text-center text-[11px] outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'duration', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item.duration || '' }} />
                                    <td className="px-3 py-2 border border-gray-300 dark:border-white/20 resize overflow-auto text-center font-black text-blue-500 text-[11px] outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'completionPercentage', parseFloat(e.target.innerText) || 0)}>{item.completionPercentage}%</td>
                                    <td className="px-3 py-2 border border-gray-300 dark:border-white/20 resize overflow-auto text-center text-gray-500 text-[11px] outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'plannedStart', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item.plannedStart || '' }} />
                                    <td className="px-3 py-2 border border-gray-300 dark:border-white/20 resize overflow-auto text-center text-[11px] outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'actualStart', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item.actualStart || '' }} />
                                    <td className="px-3 py-2 border border-gray-300 dark:border-white/20 resize overflow-auto text-center text-gray-500 text-[11px] outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'plannedEnd', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item.plannedEnd || '' }} />
                                    <td className="px-3 py-2 border border-gray-300 dark:border-white/20 resize overflow-auto text-center text-[11px] outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, 'actualEnd', e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item.actualEnd || '' }} />
                                    {el.headers.length > 7 && el.headers.slice(7).map((_, cIdx) => (
                                        <td key={cIdx} className="px-3 py-2 border border-gray-300 dark:border-white/20 resize overflow-auto text-center text-[11px] outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleTableEdit(slide.id, el.id, idx, `dynamic_${cIdx}`, e.target.innerHTML)} dangerouslySetInnerHTML={{ __html: item[`dynamic_${cIdx}`] || '' }} />
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (el.type === 'qaqc_audit') {
            return (
                <div key={el.id} className="absolute grid grid-cols-3 gap-4" style={{ left: el.x, top: el.y, width: el.w }}>
                    <div className="col-span-1 space-y-2">
                        <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-3 rounded-xl flex justify-between items-center shadow-lg">
                            <div><p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest outline-none" contentEditable suppressContentEditableWarning>Total Inspections</p><p className="text-base font-black text-gray-900 dark:text-white outline-none" contentEditable suppressContentEditableWarning>{el.data.inspectionsConducted}</p></div>
                            <Activity className="text-blue-500" size={16} />
                        </div>
                        <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-3 rounded-xl flex justify-between items-center shadow-lg">
                            <div><p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest outline-none" contentEditable suppressContentEditableWarning>NCRs Active</p><p className="text-base font-black text-rose-500 outline-none" contentEditable suppressContentEditableWarning>{el.data.ncrRaised - el.data.ncrResolved}</p></div>
                            <X className="text-rose-500" size={16} />
                        </div>
                        <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-3 rounded-xl flex justify-between items-center shadow-lg">
                            <div><p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest outline-none" contentEditable suppressContentEditableWarning>NCRs Resolved</p><p className="text-base font-black text-emerald-500 outline-none" contentEditable suppressContentEditableWarning>{el.data.ncrResolved}</p></div>
                            <CheckCircle className="text-emerald-500" size={16} />
                        </div>
                    </div>
                    <div className="col-span-1 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-lg flex flex-col items-center justify-center">
                        <SlideDonutChart data={[{ label: 'Passed', value: el.data.passed, color: '#10B981' }, { label: 'Failed', value: el.data.failed, color: '#F43F5E' }]} totalLabel="TOTAL" />
                    </div>
                    <div className="col-span-1 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl p-3 shadow-lg space-y-2 overflow-hidden flex flex-col justify-center">
                        <h6 className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Key Observations</h6>
                        {el.data.keyObservations.slice(0, 3).map((obs, idx) => (
                            <div key={idx} className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg border-l-2 border-l-blue-500">
                                <p className="text-[8px] font-bold text-gray-900 dark:text-white uppercase mb-0.5 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => {
                                    const newData = { ...el.data };
                                    newData.keyObservations[idx].test = e.target.innerHTML;
                                    handleUpdateElement(slide.id, el.id, { data: newData });
                                }} dangerouslySetInnerHTML={{ __html: obs.test || '' }} />
                                <p className="text-[7px] text-gray-500 outline-none line-clamp-1" contentEditable suppressContentEditableWarning onBlur={(e) => {
                                    const newData = { ...el.data };
                                    newData.keyObservations[idx].remark = e.target.innerHTML;
                                    handleUpdateElement(slide.id, el.id, { data: newData });
                                }} dangerouslySetInnerHTML={{ __html: obs.remark || '' }} />
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (el.type === 'roadmap') {
            return (
                <div key={el.id} className="absolute bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-6 rounded-2xl shadow-lg space-y-3" style={{ left: el.x, top: el.y, width: el.w }}>
                    <div className="flex items-center space-x-2.5 text-blue-500 mb-3"><Target size={20} /><h4 className="font-black text-lg tracking-tight text-gray-900 dark:text-white outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleUpdateElement(slide.id, el.id, { title: e.target.innerHTML })} dangerouslySetInnerHTML={{ __html: el.title || 'Strategic Goals' }} /></div>
                    {el.data.map((plan, idx) => (
                        <div key={idx} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                            <div className="w-6 h-6 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-black text-[10px]">{idx + 1}</div>
                            <p className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => {
                                const newData = [...el.data];
                                newData[idx] = e.target.innerHTML;
                                handleUpdateElement(slide.id, el.id, { data: newData });
                            }} dangerouslySetInnerHTML={{ __html: plan || '' }} />
                        </div>
                    ))}
                </div>
            );
        }

        if (el.type === 'upload_zone') {
            const beforeUrl = el.data?.beforeUrl;
            const afterUrl = el.data?.afterUrl;

            return (
                <div key={el.id} className="absolute flex flex-row items-center justify-between space-x-6" style={{ left: '10%', top: el.y, width: '80%', height: el.h }}>
                    {/* Before Image */}
                    <div className="flex-1 flex flex-col h-full group relative">
                        <span className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest text-center mb-3">Before Progress</span>
                        {beforeUrl ? (
                            <div className="relative w-full flex-1 rounded-2xl shadow-xl overflow-hidden border-4 border-white dark:border-[#161b22]">
                                <img src={beforeUrl} className="w-full h-full object-cover" alt="Before Progress" />
                                {!isFullscreen && (
                                    <button onMouseDown={(e) => { e.stopPropagation(); handleUpdateElement(slide.id, el.id, { data: { ...el.data, beforeUrl: null } }); }} className="absolute top-3 right-3 p-2 bg-rose-500/90 hover:bg-rose-500 text-white rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                        <Trash size={16} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div onClick={() => document.getElementById(`upload-before-${el.id}`).click()} className="w-full flex-1 border-2 border-dashed border-gray-300 dark:border-white/20 rounded-2xl flex flex-col items-center justify-center bg-gray-50/50 dark:bg-white/[0.01] hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer shadow-inner">
                                <ImageIcon size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
                                <p className="text-xs font-bold text-gray-500">Upload Before Image</p>
                                <input id={`upload-before-${el.id}`} type="file" className="hidden" accept="image/*" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = ev => handleUpdateElement(slide.id, el.id, { data: { ...el.data, beforeUrl: ev.target.result } });
                                        reader.readAsDataURL(file);
                                    }
                                }} />
                            </div>
                        )}
                    </div>
                    
                    {/* After Image */}
                    <div className="flex-1 flex flex-col h-full group relative">
                        <span className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest text-center mb-3">After Progress</span>
                        {afterUrl ? (
                            <div className="relative w-full flex-1 rounded-2xl shadow-xl overflow-hidden border-4 border-white dark:border-[#161b22]">
                                <img src={afterUrl} className="w-full h-full object-cover" alt="After Progress" />
                                {!isFullscreen && (
                                    <button onMouseDown={(e) => { e.stopPropagation(); handleUpdateElement(slide.id, el.id, { data: { ...el.data, afterUrl: null } }); }} className="absolute top-3 right-3 p-2 bg-rose-500/90 hover:bg-rose-500 text-white rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                        <Trash size={16} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div onClick={() => document.getElementById(`upload-after-${el.id}`).click()} className="w-full flex-1 border-2 border-dashed border-gray-300 dark:border-white/20 rounded-2xl flex flex-col items-center justify-center bg-gray-50/50 dark:bg-white/[0.01] hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer shadow-inner">
                                <ImageIcon size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
                                <p className="text-xs font-bold text-gray-500">Upload After Image</p>
                                <input id={`upload-after-${el.id}`} type="file" className="hidden" accept="image/*" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = ev => handleUpdateElement(slide.id, el.id, { data: { ...el.data, afterUrl: ev.target.result } });
                                        reader.readAsDataURL(file);
                                    }
                                }} />
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    };

    const currentSlide = slides[activeSlide];

    // Handle export to PDF
    const handleExportPDF = async () => {
        setIsExporting(true);
        const originalSlide = activeSlide;
        
        try {
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [1920, 1080]
            });

            let addedPages = 0;
            for (let i = 0; i < slides.length; i++) {
                if (slides[i].isHidden) continue;
                
                flushSync(() => {
                    setActiveSlide(i);
                });

                // Minimal delay because animations are disabled during export
                await new Promise(r => setTimeout(r, 20));

                const canvasElement = document.querySelector('[data-slide-canvas]');
                if (!canvasElement) continue;

                // toJpeg with 1.5 pixelRatio is ~4-5x faster than toPng with 2.0 pixelRatio
                const dataUrl = await toJpeg(canvasElement, {
                    quality: 0.85,
                    pixelRatio: 1.5,
                    style: { transform: 'none', transformOrigin: 'top left' }
                });

                if (addedPages > 0) {
                    pdf.addPage([1920, 1080], 'landscape');
                }
                
                pdf.addImage(dataUrl, 'JPEG', 0, 0, 1920, 1080);
                addedPages++;
            }

            pdf.save(`${reportData?.month || 'Executive_Report'}_Presentation.pdf`);
        } catch (error) {
            console.error("Failed to export PDF", error);
            alert("Failed to export PDF. See console for details.");
        } finally {
            flushSync(() => {
                setActiveSlide(originalSlide);
            });
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[4000] bg-gray-100 dark:bg-[#0a0d11] flex flex-col anim-fade-in">
            {/* Exporting Overlay to hide slide flickering */}
            {isExporting && (
                <div className="fixed inset-0 bg-white/95 dark:bg-[#0a0d11]/95 z-[9999] flex flex-col items-center justify-center backdrop-blur-md">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6 shadow-lg shadow-blue-500/20" />
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-2">Generating High-Fidelity PDF</h2>
                    <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm">Please do not close this window...</p>
                </div>
            )}



            {/* Header Toolbar */}
            {!isFullscreen && (
            <div className="relative h-16 bg-white dark:bg-[#161b22] border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-6 shadow-sm z-[100]">
                <div className="flex items-center space-x-4">
                    <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors">
                        <X size={20} className="text-gray-600 dark:text-gray-400" />
                    </button>
                    <div>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Presentation Editor</h2>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Auto-saving in browser...</p>
                    </div>
                </div>

                <div className="flex items-center space-x-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl hidden md:flex">
                    <button onClick={handleAddTextElement} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-colors text-gray-600 dark:text-gray-400 tooltip-trigger" title="Add Text Box"><Type size={16} /></button>
                    <button onClick={handleAddImageElement} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-colors text-gray-600 dark:text-gray-400 tooltip-trigger" title="Insert Image"><ImageIcon size={16} /></button>
                    
                    <div className="w-px h-5 bg-gray-300 dark:bg-white/10 mx-1" />
                    
                    <button onMouseDown={e => { e.preventDefault(); execCommand('bold'); }} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-400" title="Bold"><Bold size={16} /></button>
                    <button onMouseDown={e => { e.preventDefault(); execCommand('italic'); }} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-400" title="Italic"><Italic size={16} /></button>
                    
                    <div className="w-px h-5 bg-gray-300 dark:bg-white/10 mx-1" />
                    
                    <button onMouseDown={e => { e.preventDefault(); execCommand('justifyLeft'); }} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-400"><AlignLeft size={16} /></button>
                    <button onMouseDown={e => { e.preventDefault(); execCommand('justifyCenter'); }} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-400"><AlignCenter size={16} /></button>
                    <button onMouseDown={e => { e.preventDefault(); execCommand('justifyRight'); }} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-400"><AlignRight size={16} /></button>
                    
                    <div className="w-px h-5 bg-gray-300 dark:bg-white/10 mx-1" />
                    
                    <div className="relative group flex items-center">
                        <button className="px-2 py-1.5 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-400 text-[11px] font-black flex items-center space-x-0.5" title="Font Size">
                            <span>SIZE</span>
                        </button>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1.5 hidden group-hover:block z-[6000]">
                            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-xl rounded-lg p-1 flex flex-col space-y-1 w-16">
                                {['12px', '16px', '20px', '24px', '32px', '48px', '64px'].map(size => (
                                    <button
                                        key={size}
                                        onMouseDown={e => {
                                            e.preventDefault();
                                            const selection = window.getSelection();
                                            if (selection && selection.rangeCount > 0) {
                                                const range = selection.getRangeAt(0);
                                                const span = document.createElement('span');
                                                span.style.fontSize = size;
                                                span.appendChild(range.extractContents());
                                                range.insertNode(span);
                                            }
                                        }}
                                        className="text-[9px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 py-1 px-1.5 rounded text-center transition-colors"
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="w-px h-5 bg-gray-300 dark:bg-white/10 mx-1" />
                    
                    <div className="relative group flex items-center">
                        <button className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-400 flex items-center" title="Text Color"><Palette size={16} /></button>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1.5 hidden group-hover:block z-[6000]">
                            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-lg rounded-lg p-1.5 flex space-x-2">
                                {['#F43F5E', '#3B82F6', '#10B981', '#F59E0B', '#6B7280', '#111827', '#FFFFFF'].map(color => (
                                    <button key={color} onMouseDown={e => { e.preventDefault(); execCommand('foreColor', color); }} className="w-5 h-5 rounded-full border border-black/10 dark:border-white/10 hover:scale-110 transition-transform" style={{ backgroundColor: color }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <button onClick={() => setShowThemePanel(!showThemePanel)} className={`p-2.5 rounded-xl transition-all ${showThemePanel ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`} title="Slide Themes">
                            <LayoutTemplate size={18} />
                        </button>

                        {/* Theme Selection Dropdown */}
                        <AnimatePresence>
                            {showThemePanel && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-4 w-72 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 z-50 origin-top-right"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Global Theme</h4>
                                        <button onClick={() => setShowThemePanel(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={14} /></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-6">
                                        {THEMES.map(theme => (
                                            <button
                                                key={theme.id}
                                                onClick={() => setActiveTheme(theme)}
                                                className={`p-2 rounded-xl border-2 transition-all text-left flex flex-col gap-1.5 ${activeTheme.id === theme.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-gray-100 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20'}`}
                                            >
                                                <div className="flex w-full h-8 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 shadow-sm">
                                                    <div className="w-1/2 h-full" style={{ background: theme.previewColors[0] }} />
                                                    <div className="w-1/2 h-full" style={{ background: theme.previewColors[1] }} />
                                                </div>
                                                <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 leading-tight">{theme.name}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-3 border-t border-gray-100 dark:border-white/5 pt-4">Current Slide Background</h4>
                                    <div className="flex gap-2 mb-3">
                                        {['#ffffff', '#f8fafc', '#0f172a', '#1e293b', '#082f49', '#450a0a'].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => handleUpdateSlideBackground(color)}
                                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shadow-sm ${currentSlide.background === color ? 'border-blue-500 scale-110' : 'border-black/10 dark:border-white/20'}`}
                                                style={{ background: color }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleUpdateSlideBackground(null)} className="flex-1 py-1.5 text-[9px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg uppercase tracking-wider">Reset to Theme</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button onClick={handleExportPDF} className="flex items-center space-x-2 px-6 py-2.5 bg-orange-500/10 hover:bg-orange-500 text-orange-600 hover:text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider">
                        <Download size={16} />
                        <span>Export PDF</span>
                    </button>
                    <button onClick={() => setIsFullscreen(!isFullscreen)} className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20">
                        {isFullscreen ? <X size={16} /> : <Play size={16} />}
                        <span>{isFullscreen ? 'Exit Presentation' : 'Present'}</span>
                    </button>
                </div>
            </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar Thumbnails */}
                {!isFullscreen && (
                    <div className="w-64 bg-white dark:bg-[#161b22] border-r border-gray-200 dark:border-white/5 overflow-y-auto custom-scrollbar p-4 space-y-4">
                        {slides.map((slide, idx) => (
                            <div
                                key={slide.id}
                                onClick={() => {
                                    setSlideDirection(idx > activeSlide ? 1 : -1);
                                    setActiveSlide(idx);
                                }}
                                draggable
                                onDragStart={() => handleDragStart(idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, idx)}
                                className={`group relative w-full aspect-video rounded-xl border-2 transition-all cursor-pointer overflow-hidden ${activeSlide === idx ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'} ${dragOverIdx === idx ? 'border-t-4 border-t-blue-500' : ''} ${slide.isHidden ? 'opacity-40 grayscale' : ''}`}
                            >
                                <div className="absolute inset-0 bg-gray-50 dark:bg-[#0d1117] pointer-events-none flex items-center justify-center p-2 text-center" style={{ background: slide.background || activeTheme.canvasStyle.background }}>
                                    <span className="text-[9px] font-bold text-gray-400 tracking-tight leading-tight">{slide.title || 'Slide'}</span>
                                </div>
                                <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/50 backdrop-blur-md rounded flex items-center justify-center text-white text-[9px] font-black z-10">
                                    {idx + 1}
                                </div>
                                <div className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity z-10">
                                    <button onClick={(e) => handleToggleHideSlide(e, idx)} className="p-1.5 bg-black/60 hover:bg-gray-600 rounded text-white backdrop-blur-md transition-colors" title={slide.isHidden ? 'Show Slide' : 'Hide Slide'}>
                                        {slide.isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                    <button onClick={(e) => handleDuplicateSlide(e, slide, idx)} className="p-1.5 bg-black/60 hover:bg-blue-600 rounded text-white backdrop-blur-md transition-colors" title="Duplicate Slide"><Copy size={12} /></button>
                                    <button onClick={(e) => handleDeleteSlide(e, idx)} className="p-1.5 bg-black/60 hover:bg-rose-600 rounded text-white backdrop-blur-md transition-colors" title="Delete Slide"><Trash size={12} /></button>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 flex items-end justify-center pb-1 transition-opacity z-10">
                                    <GripVertical size={14} className="text-white/50" />
                                </div>
                            </div>
                        ))}
                        <button onClick={handleAddSlide} className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-white/20 rounded-xl flex items-center justify-center space-x-2 text-gray-500 hover:text-blue-500 hover:border-blue-500 transition-all hover:bg-blue-500/5 font-bold text-xs uppercase tracking-widest">
                            <Plus size={16} />
                            <span>Add Slide</span>
                        </button>
                    </div>
                )}

                {/* Main Canvas Area */}
                <div 
                    className={`flex-1 overflow-auto bg-gray-200 dark:bg-[#0a0d11] flex ${isFullscreen ? 'flex-col items-center justify-center p-0' : 'flex-col xl:flex-row items-center xl:items-start justify-center p-4 md:p-8 space-y-8 xl:space-y-0 xl:space-x-8'}`}
                    onClick={() => setSelectedElementId(null)}
                    onWheel={handleWheel}
                >
                    {/* Fullscreen Overlay Controls */}
                    {isFullscreen && (
                        <div className="fixed inset-0 z-[5000] pointer-events-none flex flex-col justify-between p-6">
                            <div className="flex justify-end">
                                <button onClick={() => setIsFullscreen(false)} className="pointer-events-auto flex items-center space-x-2 px-4 py-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-xl transition-all opacity-0 hover:opacity-100 group">
                                    <X size={20} />
                                    <span className="text-xs font-bold uppercase tracking-widest hidden group-hover:inline">Exit Presentation (Esc)</span>
                                </button>
                            </div>
                            <div className="flex justify-between items-center px-4 pb-4">
                                <button onClick={(e) => { e.stopPropagation(); setSlideDirection(-1); setActiveSlide(p => Math.max(p - 1, 0)); }} className="pointer-events-auto p-4 bg-black/20 hover:bg-black/60 backdrop-blur-md text-white rounded-full transition-all opacity-0 hover:opacity-100 disabled:opacity-0" disabled={activeSlide === 0}>
                                    <ChevronLeft size={32} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setSlideDirection(1); setActiveSlide(p => Math.min(p + 1, slides.length - 1)); }} className="pointer-events-auto p-4 bg-black/20 hover:bg-black/60 backdrop-blur-md text-white rounded-full transition-all opacity-0 hover:opacity-100 disabled:opacity-0" disabled={activeSlide === slides.length - 1}>
                                    <ChevronRight size={32} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* The 16:9 Canvas */}
                    <div 
                        ref={canvasRef}
                        data-slide-canvas
                        className={`relative shadow-2xl overflow-hidden min-w-0 shrink transition-all duration-500 ${isFullscreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-5xl aspect-video rounded-2xl ring-1 ring-black/5'}`}
                        style={{
                            ...(currentSlide.background
                                ? { background: currentSlide.background }
                                : activeTheme.canvasStyle
                            )
                        }}
                        onClick={() => { setSelectedElementId(null); setShowThemePanel(false); }}
                    >
                        {/* Scoped text-colour override based on active theme */}
                        {(() => {
                            const slideBg = currentSlide.background;
                            const isDark = slideBg ? isBgDark(slideBg) : activeTheme.dark;
                            const tp = slideBg ? (isDark ? '#ffffff' : '#000000') : activeTheme.textPrimary;
                            const tm = slideBg ? (isDark ? '#e2e8f0' : '#475569') : activeTheme.textMuted;
                            return (
                                <style>{`
                                    [data-slide-canvas] { --text-primary: ${tp}; --text-muted: ${tm}; color: var(--text-primary); }
                                    [data-slide-canvas] .text-gray-900, [data-slide-canvas] .dark\\:text-white, [data-slide-canvas] .dark\\:text-gray-200, [data-slide-canvas] .dark\\:text-gray-300 { color: var(--text-primary) !important; }
                                    [data-slide-canvas] .text-gray-500, [data-slide-canvas] .dark\\:text-gray-400 { color: var(--text-muted) !important; }
                                    
                                    ${!isDark ? `
                                        /* Force light mode styling even if OS/Tailwind is in dark mode */
                                        [data-slide-canvas] .dark\\:bg-white\\/\\[0\\.02\\] { background-color: #ffffff !important; }
                                        [data-slide-canvas] .dark\\:border-white\\/10 { border-color: #e5e7eb !important; }
                                        [data-slide-canvas] .dark\\:border-white\\/20 { border-color: #e5e7eb !important; }
                                        [data-slide-canvas] .dark\\:bg-white\\/5 { background-color: #f9fafb !important; }
                                        [data-slide-canvas] .dark\\:hover\\:bg-white\\/10:hover { background-color: #f3f4f6 !important; }
                                        [data-slide-canvas] .dark\\:hover\\:bg-white\\/\\[0\\.05\\]:hover { background-color: #f3f4f6 !important; }
                                        [data-slide-canvas] .dark\\:text-\\[\\#0d1117\\] { color: #ffffff !important; }
                                        [data-slide-canvas] .dark\\:border-\\[\\#0d1117\\] { border-color: #ffffff !important; }
                                        [data-slide-canvas] .dark\\:border-\\[\\#161b22\\] { border-color: #ffffff !important; }
                                        [data-slide-canvas] .dark\\:bg-\\[\\#161b22\\] { background-color: #ffffff !important; }

                                        /* Force black borders on tables in light mode */
                                        [data-slide-canvas] table .border-gray-300,
                                        [data-slide-canvas] table .border-gray-200,
                                        [data-slide-canvas] table .dark\\:border-white\\/20,
                                        [data-slide-canvas] table .dark\\:border-white\\/10,
                                        [data-slide-canvas] table th, 
                                        [data-slide-canvas] table td,
                                        [data-slide-canvas] div:has(> table) { 
                                            border: 2px solid #000000 !important; 
                                            border-color: #000000 !important;
                                        }

                                        /* Force chart labels to be black in light mode */
                                        [data-slide-canvas] .dark\\:fill-white { fill: #000000 !important; }
                                    ` : `
                                        /* Force dark mode styling even if OS/Tailwind is in light mode */
                                        [data-slide-canvas] .bg-white { background-color: rgba(255, 255, 255, 0.02) !important; }
                                        [data-slide-canvas] .bg-gray-50 { background-color: rgba(255, 255, 255, 0.05) !important; }
                                        [data-slide-canvas] .border-gray-200 { border-color: rgba(255, 255, 255, 0.1) !important; }
                                        [data-slide-canvas] .border-gray-100 { border-color: rgba(255, 255, 255, 0.05) !important; }
                                    `}
                                `}</style>
                            );
                        })()}

                        <AnimatePresence initial={false} custom={slideDirection}>
                            <motion.div
                                key={activeSlide}
                                custom={slideDirection}
                                variants={{
                                    enter: (dir) => ({ y: dir > 0 ? '100%' : '-100%', opacity: 0 }),
                                    center: { y: 0, opacity: 1, zIndex: 1 },
                                    exit: (dir) => ({ y: dir > 0 ? '-100%' : '100%', opacity: 0, zIndex: 0 })
                                }}
                                initial={isExporting ? false : "enter"}
                                animate="center"
                                exit={isExporting ? false : "exit"}
                                transition={isExporting ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                                className="absolute inset-0 w-full h-full"
                            >

                        {/* Top-left corner image */}
                        {globalHeader.url ? (
                            <InteractiveWrapper el={globalHeader} slideId="global" isSelected={selectedElementId === globalHeader.id} onSelect={setSelectedElementId} onUpdate={(sid, eid, data) => setGlobalHeader(prev => ({ ...prev, ...data }))} canvasRef={canvasRef}>
                                <div className="w-full h-full group">
                                    <img src={globalHeader.url} alt="Header" className="w-full h-full object-contain pointer-events-none" />
                                    {!isFullscreen && (
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                                            <button onMouseDown={(e) => { e.stopPropagation(); document.getElementById('header-upload').click(); }} className="p-1.5 bg-white/20 hover:bg-white/40 rounded backdrop-blur-sm text-white" title="Change Header"><ImageIcon size={14} /></button>
                                            <button onMouseDown={(e) => { e.stopPropagation(); setGlobalHeader(prev => ({ ...prev, url: null })); }} className="p-1.5 bg-rose-500/80 hover:bg-rose-500 rounded backdrop-blur-sm text-white" title="Remove Header"><Trash size={14} /></button>
                                        </div>
                                    )}
                                </div>
                            </InteractiveWrapper>
                        ) : !isFullscreen && (
                            <button 
                                onClick={() => document.getElementById('header-upload').click()}
                                className="absolute flex flex-col items-center justify-center border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                style={{ left: globalHeader.x, top: globalHeader.y, width: globalHeader.w, height: '40px' }}
                            >
                                <div className="flex items-center space-x-1"><Plus size={12} /><ImageIcon size={12} /></div>
                                <span className="text-[8px] font-bold uppercase tracking-widest mt-0.5">Add Header</span>
                            </button>
                        )}
                        <input id="header-upload" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=ev=>setGlobalHeader(prev=>({...prev, url: ev.target.result})); r.readAsDataURL(f); } }} />

                        {/* Bottom-right corner image */}
                        {globalFooter.url ? (
                            <InteractiveWrapper el={globalFooter} slideId="global" isSelected={selectedElementId === globalFooter.id} onSelect={setSelectedElementId} onUpdate={(sid, eid, data) => setGlobalFooter(prev => ({ ...prev, ...data }))} canvasRef={canvasRef}>
                                <div className="w-full h-full group">
                                    <img src={globalFooter.url} alt="Footer" className="w-full h-full object-contain pointer-events-none" />
                                    {!isFullscreen && (
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                                            <button onMouseDown={(e) => { e.stopPropagation(); document.getElementById('footer-upload').click(); }} className="p-1.5 bg-white/20 hover:bg-white/40 rounded backdrop-blur-sm text-white" title="Change Footer"><ImageIcon size={14} /></button>
                                            <button onMouseDown={(e) => { e.stopPropagation(); setGlobalFooter(prev => ({ ...prev, url: null })); }} className="p-1.5 bg-rose-500/80 hover:bg-rose-500 rounded backdrop-blur-sm text-white" title="Remove Footer"><Trash size={14} /></button>
                                        </div>
                                    )}
                                </div>
                            </InteractiveWrapper>
                        ) : !isFullscreen && (
                            <button 
                                onClick={() => document.getElementById('footer-upload').click()}
                                className="absolute flex flex-col items-center justify-center border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                style={{ left: globalFooter.x, top: globalFooter.y, width: globalFooter.w, height: '40px' }}
                            >
                                <div className="flex items-center space-x-1"><Plus size={12} /><ImageIcon size={12} /></div>
                                <span className="text-[8px] font-bold uppercase tracking-widest mt-0.5">Add Footer</span>
                            </button>
                        )}
                        <input id="footer-upload" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=ev=>setGlobalFooter(prev=>({...prev, url: ev.target.result})); r.readAsDataURL(f); } }} />

                        {/* Slide number badge - bottom left */}
                        <div className="absolute bottom-4 left-5 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest pointer-events-none z-20">
                            {activeSlide + 1} / {slides.length}
                        </div>

                        {/* Slide Elements */}
                        {currentSlide.elements.map(el => (
                            <InteractiveWrapper
                                key={el.id}
                                el={el}
                                slideId={currentSlide.id}
                                isSelected={selectedElementId === el.id}
                                onSelect={setSelectedElementId}
                                onUpdate={handleUpdateElement}
                                onAddRow={handleAddRow}
                                onAddColumn={handleAddColumn}
                                onDeleteRow={handleDeleteRow}
                                onDeleteColumn={handleDeleteColumn}
                                canvasRef={canvasRef}
                            >
                                {renderElement(currentSlide, el)}
                            </InteractiveWrapper>
                        ))}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {!isFullscreen && (
                        <div className="w-full xl:w-80 h-auto xl:h-[calc(100vh-160px)] shrink-0 bg-white dark:bg-[#161b22] rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-white/10 flex flex-col mb-12 xl:mb-0" onClick={(e) => e.stopPropagation()}>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center space-x-2 shrink-0">
                                <AlignLeft size={14} />
                                <span>Presenter Notes</span>
                            </label>
                            <textarea
                                value={currentSlide.notes || ''}
                                onChange={(e) => {
                                    const newSlides = [...slides];
                                    newSlides[activeSlide] = { ...newSlides[activeSlide], notes: e.target.value };
                                    setSlides(newSlides);
                                }}
                                placeholder="Click to add speaker notes for this slide. These notes will not be exported to PDF and are only visible in editor mode."
                                className="w-full flex-1 min-h-[120px] bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 border-none focus:ring-0 resize-none p-0 outline-none custom-scrollbar"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PPTEditor;
