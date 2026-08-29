import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Search,
    Replace,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    Sparkles,
    GripVertical,
    ListFilter,
    ArrowUp,
    ArrowDown
} from 'lucide-react';

export const ExcelFindReplaceModal = ({
    isOpen,
    onClose,
    columns = [],
    sortedGridData = [],
    selectionFocus,
    setSelectionAnchor,
    setSelectionFocus,
    onReplaceValue,
    onReplaceAll,
    initialMode = 'find', // 'find' | 'replace'
    currentPage = 1,
    setCurrentPage = null,
    pageSize = 100,
    onFindQueryChange = null
}) => {
    const [mode, setMode] = useState(initialMode);
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [matchCase, setMatchCase] = useState(false);
    const [matchExact, setMatchExact] = useState(false);
    const [message, setMessage] = useState('');
    const [showResultsList, setShowResultsList] = useState(true);

    // Floating Draggable Position
    const [position, setPosition] = useState(null); // { x, y }
    const isDraggingRef = useRef(false);
    const dragStartOffsetRef = useRef({ x: 0, y: 0 });
    const modalRef = useRef(null);
    const findInputRef = useRef(null);

    // Synchronize mode when opened
    useEffect(() => {
        setMode(initialMode);
        setMessage('');
    }, [initialMode, isOpen]);

    // Focus search input when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                if (findInputRef.current) {
                    findInputRef.current.focus();
                    findInputRef.current.select();
                }
            }, 50);
        }
    }, [isOpen]);

    // Notify parent component about current find query for sheet highlighting
    useEffect(() => {
        if (onFindQueryChange) {
            if (isOpen && findText.trim()) {
                onFindQueryChange({
                    query: findText,
                    matchCase,
                    matchExact
                });
            } else {
                onFindQueryChange(null);
            }
        }
    }, [isOpen, findText, matchCase, matchExact, onFindQueryChange]);

    // Clear highlight when unmounted or closed
    useEffect(() => {
        return () => {
            if (onFindQueryChange) {
                onFindQueryChange(null);
            }
        };
    }, [onFindQueryChange]);

    // Compute all matches across the dataset
    const matches = useMemo(() => {
        if (!findText || !findText.trim()) return [];
        const result = [];
        const query = matchCase ? findText : findText.toLowerCase();

        sortedGridData.forEach((row, rIdx) => {
            columns.forEach((col, cIdx) => {
                if (col.readOnly) return;
                const cellVal = String(row[col.key] ?? '');
                const target = matchCase ? cellVal : cellVal.toLowerCase();

                const isMatch = matchExact ? target === query : target.includes(query);
                if (isMatch) {
                    result.push({
                        r: rIdx,
                        c: cIdx,
                        colKey: col.key,
                        colLabel: col.label || col.key,
                        value: cellVal,
                        rowId: row.id || `row-${rIdx}`
                    });
                }
            });
        });
        return result;
    }, [sortedGridData, columns, findText, matchCase, matchExact]);

    // Identify index of currently focused match
    const currentMatchIndex = useMemo(() => {
        if (!selectionFocus || matches.length === 0) return -1;
        return matches.findIndex(
            (m) => m.r === selectionFocus.r && m.c === selectionFocus.c
        );
    }, [selectionFocus, matches]);

    // Jump to a specific match with auto-page and smooth scrolling
    const jumpToMatch = useCallback(
        (match) => {
            if (!match) return;

            setSelectionAnchor({ r: match.r, c: match.c });
            setSelectionFocus({ r: match.r, c: match.c });

            // Automatically switch pagination page if on a different page
            if (pageSize !== 'All' && setCurrentPage) {
                const targetPage = Math.floor(match.r / Number(pageSize)) + 1;
                if (currentPage !== targetPage) {
                    setCurrentPage(targetPage);
                }
            }

            // Smooth scroll into visible center of table
            setTimeout(() => {
                const cellEl = document.getElementById(`excel-cell-${match.r}-${match.colKey}`);
                if (cellEl) {
                    cellEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            }, 80);
        },
        [pageSize, setCurrentPage, currentPage, setSelectionAnchor, setSelectionFocus]
    );

    // Find Next Match
    const handleFindNext = useCallback(() => {
        if (matches.length === 0) {
            setMessage('No matching cells found');
            return;
        }

        const curR = selectionFocus?.r ?? -1;
        const curC = selectionFocus?.c ?? -1;

        // Find next match sequentially after current focus
        let nextMatch = matches.find((m) => m.r > curR || (m.r === curR && m.c > curC));
        if (!nextMatch) nextMatch = matches[0]; // Wrap around to beginning

        jumpToMatch(nextMatch);
        setMessage('');
    }, [matches, selectionFocus, jumpToMatch]);

    // Find Previous Match
    const handleFindPrev = useCallback(() => {
        if (matches.length === 0) {
            setMessage('No matching cells found');
            return;
        }

        const curR = selectionFocus?.r ?? 999999;
        const curC = selectionFocus?.c ?? 999999;

        const revMatches = [...matches].reverse();
        let prevMatch = revMatches.find((m) => m.r < curR || (m.r === curR && m.c < curC));
        if (!prevMatch) prevMatch = revMatches[0]; // Wrap around to end

        jumpToMatch(prevMatch);
        setMessage('');
    }, [matches, selectionFocus, jumpToMatch]);

    // Replace currently active cell
    const handleReplaceCurrent = () => {
        if (!selectionFocus) {
            handleFindNext();
            return;
        }

        const curRow = sortedGridData[selectionFocus.r];
        const curCol = columns[selectionFocus.c];
        if (!curRow || !curCol || curCol.readOnly) {
            handleFindNext();
            return;
        }

        const cellVal = String(curRow[curCol.key] ?? '');
        const query = matchCase ? findText : findText.toLowerCase();
        const target = matchCase ? cellVal : cellVal.toLowerCase();

        const isMatch = matchExact ? target === query : target.includes(query);
        if (isMatch) {
            let newVal = cellVal;
            if (matchExact) {
                newVal = replaceText;
            } else {
                const regex = new RegExp(
                    findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                    matchCase ? 'g' : 'gi'
                );
                newVal = cellVal.replace(regex, replaceText);
            }
            onReplaceValue(selectionFocus.r, curCol.key, newVal);
            setMessage('Replaced 1 instance');
            setTimeout(() => handleFindNext(), 50);
        } else {
            handleFindNext();
        }
    };

    // Replace all matching instances
    const handleReplaceAllMatches = () => {
        if (matches.length === 0) {
            setMessage('No matching cells found to replace');
            return;
        }

        onReplaceAll(findText, replaceText, matchCase, matchExact);
        setMessage(`Successfully replaced ${matches.length} instance(s)`);
    };

    // Dragging Handlers
    const handleHeaderMouseDown = (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        isDraggingRef.current = true;

        const modalEl = modalRef.current;
        if (modalEl) {
            const rect = modalEl.getBoundingClientRect();
            dragStartOffsetRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        const handleMouseMove = (moveEvent) => {
            if (!isDraggingRef.current) return;
            const newX = Math.max(10, Math.min(window.innerWidth - 410, moveEvent.clientX - dragStartOffsetRef.current.x));
            const newY = Math.max(10, Math.min(window.innerHeight - 180, moveEvent.clientY - dragStartOffsetRef.current.y));
            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Helper to highlight matching text in snippet
    const renderSnippet = (text) => {
        if (!findText || !text) return text;
        const query = matchCase ? findText : findText.toLowerCase();
        const strText = String(text);
        const compText = matchCase ? strText : strText.toLowerCase();

        const idx = compText.indexOf(query);
        if (idx === -1) return strText;

        const before = strText.substring(0, idx);
        const match = strText.substring(idx, idx + findText.length);
        const after = strText.substring(idx + findText.length);

        return (
            <span>
                {before}
                <span className="bg-amber-300 dark:bg-amber-500 text-black dark:text-gray-900 font-bold px-0.5 rounded-xs">
                    {match}
                </span>
                {after}
            </span>
        );
    };

    if (!isOpen) return null;

    const floatingStyle = position
        ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' }
        : { top: '80px', right: '30px' };

    return (
        /* Non-blocking pointer-events-none container so spreadsheet is completely visible and interactive */
        <div className="fixed inset-0 z-[6000] pointer-events-none overflow-hidden select-none">
            <div
                ref={modalRef}
                style={floatingStyle}
                className="pointer-events-auto absolute w-[390px] max-w-[95vw] bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 font-sans"
            >
                {/* ─── DRAGGABLE HEADER ─── */}
                <div
                    onMouseDown={handleHeaderMouseDown}
                    className="px-3.5 py-2.5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/80 dark:bg-white/[0.03] cursor-grab active:cursor-grabbing select-none"
                >
                    <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-gray-400 dark:text-gray-500" />
                        <div className="p-1 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            {mode === 'replace' ? <Replace size={14} /> : <Search size={14} />}
                        </div>
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                            {mode === 'replace' ? 'Find and Replace' : 'Find in Sheet'}
                        </span>
                        {/* Live Match Counter Badge */}
                        {findText.trim() && (
                            <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    matches.length > 0
                                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                        : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                {matches.length > 0
                                    ? `${currentMatchIndex >= 0 ? currentMatchIndex + 1 : 1} of ${matches.length}`
                                    : '0 matches'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
                            title="Close (Esc)"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* ─── TABS ─── */}
                <div className="px-3.5 pt-1.5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between text-xs font-bold bg-gray-50/40 dark:bg-transparent select-none">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setMode('find');
                                setMessage('');
                            }}
                            className={`pb-2 border-b-2 text-xs font-bold transition-colors cursor-pointer ${
                                mode === 'find'
                                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            Find
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setMode('replace');
                                setMessage('');
                            }}
                            className={`pb-2 border-b-2 text-xs font-bold transition-colors cursor-pointer ${
                                mode === 'replace'
                                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            Replace
                        </button>
                    </div>

                    {/* Results list collapse toggle */}
                    {matches.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowResultsList(!showResultsList)}
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer pb-1.5"
                        >
                            <ListFilter size={12} />
                            <span>{showResultsList ? 'Hide Results' : `Show (${matches.length})`}</span>
                        </button>
                    )}
                </div>

                {/* ─── FORM CONTROLS ─── */}
                <div className="p-3.5 space-y-2.5 text-xs">
                    {/* Find Input */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
                                Find what:
                            </label>
                            {findText && (
                                <button
                                    type="button"
                                    onClick={() => setFindText('')}
                                    className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="relative flex items-center">
                            <input
                                ref={findInputRef}
                                type="text"
                                value={findText}
                                onChange={(e) => setFindText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (e.shiftKey) handleFindPrev();
                                        else handleFindNext();
                                    }
                                    if (e.key === 'Escape') onClose();
                                }}
                                placeholder="Type search text…"
                                className="w-full pl-2.5 pr-16 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium"
                            />
                            {/* Prev / Next mini buttons right inside search input */}
                            <div className="absolute right-1 flex items-center gap-0.5">
                                <button
                                    type="button"
                                    onClick={handleFindPrev}
                                    disabled={!findText || matches.length === 0}
                                    className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition cursor-pointer"
                                    title="Previous Match (Shift+Enter)"
                                >
                                    <ChevronUp size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFindNext}
                                    disabled={!findText || matches.length === 0}
                                    className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition cursor-pointer"
                                    title="Next Match (Enter)"
                                >
                                    <ChevronDown size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Replace Input */}
                    {mode === 'replace' && (
                        <div className="animate-in fade-in duration-150">
                            <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                                Replace with:
                            </label>
                            <input
                                type="text"
                                value={replaceText}
                                onChange={(e) => setReplaceText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleReplaceCurrent();
                                    if (e.key === 'Escape') onClose();
                                }}
                                placeholder="Type replacement text…"
                                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium"
                            />
                        </div>
                    )}

                    {/* Match Options */}
                    <div className="flex items-center justify-between pt-0.5">
                        <div className="flex items-center gap-3.5">
                            <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={matchCase}
                                    onChange={(e) => setMatchCase(e.target.checked)}
                                    className="rounded border-gray-300 dark:border-white/20 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Match case</span>
                            </label>
                            <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={matchExact}
                                    onChange={(e) => setMatchExact(e.target.checked)}
                                    className="rounded border-gray-300 dark:border-white/20 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Match exact cell</span>
                            </label>
                        </div>
                    </div>

                    {/* Notification info */}
                    {message && (
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[11px] font-semibold flex items-center gap-1.5 animate-in fade-in">
                            <Sparkles size={12} className="shrink-0" />
                            <span>{message}</span>
                        </div>
                    )}
                </div>

                {/* ─── MATCHING RESULTS LIST PANEL ─── */}
                {findText.trim() && showResultsList && (
                    <div className="border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.01]">
                        <div className="px-3.5 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-150 dark:border-white/5">
                            <span>Matching Results ({matches.length})</span>
                            <span className="font-normal lowercase">click to jump</span>
                        </div>

                        <div className="max-h-44 overflow-y-auto scrollbar-thin divide-y divide-gray-100 dark:divide-white/5">
                            {matches.length === 0 ? (
                                <div className="p-4 text-center text-xs text-gray-400 font-medium">
                                    No matching cells found
                                </div>
                            ) : (
                                matches.map((m, idx) => {
                                    const isActive =
                                        selectionFocus?.r === m.r && selectionFocus?.c === m.c;

                                    return (
                                        <div
                                            key={`match-${m.r}-${m.c}-${idx}`}
                                            onClick={() => jumpToMatch(m)}
                                            className={`px-3.5 py-1.5 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                                isActive
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold'
                                                    : 'hover:bg-gray-100/70 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <span
                                                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                                        isActive
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                                                    }`}
                                                >
                                                    #{idx + 1}
                                                </span>
                                                <div className="truncate flex-1">
                                                    <span className="text-[11px] font-bold text-gray-900 dark:text-white mr-1.5">
                                                        Row {m.r + 1} • {m.colLabel}:
                                                    </span>
                                                    <span className="text-xs text-gray-600 dark:text-gray-300 font-normal">
                                                        {renderSnippet(m.value)}
                                                    </span>
                                                </div>
                                            </div>

                                            {isActive && (
                                                <span className="shrink-0 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* ─── FOOTER ACTIONS ─── */}
                <div className="px-3.5 py-2.5 border-t border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/70 dark:bg-white/[0.02] gap-2">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleFindPrev}
                            disabled={!findText || matches.length === 0}
                            className="px-2.5 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 transition cursor-pointer flex items-center gap-1"
                        >
                            <ArrowUp size={12} />
                            <span>Prev</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleFindNext}
                            disabled={!findText || matches.length === 0}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                        >
                            <span>Find Next</span>
                            <ArrowDown size={12} />
                        </button>
                    </div>

                    {mode === 'replace' && (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleReplaceCurrent}
                                disabled={!findText || matches.length === 0}
                                className="px-2.5 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-40 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                                Replace
                            </button>
                            <button
                                type="button"
                                onClick={handleReplaceAllMatches}
                                disabled={!findText || matches.length === 0}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                                Replace All
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExcelFindReplaceModal;
