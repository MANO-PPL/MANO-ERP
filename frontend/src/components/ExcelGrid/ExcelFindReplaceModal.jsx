import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    Replace,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    Sparkles,
    AlertCircle
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
    initialMode = 'find' // 'find' | 'replace'
}) => {
    const [mode, setMode] = useState(initialMode);
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [matchCase, setMatchCase] = useState(false);
    const [matchExact, setMatchExact] = useState(false);
    const [message, setMessage] = useState('');
    const findInputRef = useRef(null);

    useEffect(() => {
        setMode(initialMode);
        setMessage('');
    }, [initialMode, isOpen]);

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

    if (!isOpen) return null;

    // Find all matches in current grid
    const findMatches = () => {
        if (!findText) return [];
        const matches = [];
        const query = matchCase ? findText : findText.toLowerCase();

        sortedGridData.forEach((row, rIdx) => {
            columns.forEach((col, cIdx) => {
                if (col.readOnly) return;
                const cellVal = String(row[col.key] ?? '');
                const target = matchCase ? cellVal : cellVal.toLowerCase();

                if (matchExact ? target === query : target.includes(query)) {
                    matches.push({ r: rIdx, c: cIdx, key: col.key, value: cellVal });
                }
            });
        });
        return matches;
    };

    const handleFindNext = () => {
        const matches = findMatches();
        if (matches.length === 0) {
            setMessage('No matching cells found');
            return;
        }

        const curR = selectionFocus?.r ?? -1;
        const curC = selectionFocus?.c ?? -1;

        // Find match after current focus
        let nextMatch = matches.find((m) => m.r > curR || (m.r === curR && m.c > curC));
        if (!nextMatch) nextMatch = matches[0]; // wrap around

        setSelectionAnchor({ r: nextMatch.r, c: nextMatch.c });
        setSelectionFocus({ r: nextMatch.r, c: nextMatch.c });
        setMessage(`Found match at row ${nextMatch.r + 1}, column: ${columns[nextMatch.c]?.label || columns[nextMatch.c]?.key}`);
    };

    const handleFindPrev = () => {
        const matches = findMatches();
        if (matches.length === 0) {
            setMessage('No matching cells found');
            return;
        }

        const curR = selectionFocus?.r ?? 999999;
        const curC = selectionFocus?.c ?? 999999;

        const revMatches = [...matches].reverse();
        let prevMatch = revMatches.find((m) => m.r < curR || (m.r === curR && m.c < curC));
        if (!prevMatch) prevMatch = revMatches[0];

        setSelectionAnchor({ r: prevMatch.r, c: prevMatch.c });
        setSelectionFocus({ r: prevMatch.r, c: prevMatch.c });
        setMessage(`Found match at row ${prevMatch.r + 1}, column: ${columns[prevMatch.c]?.label || columns[prevMatch.c]?.key}`);
    };

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
                const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
                newVal = cellVal.replace(regex, replaceText);
            }
            onReplaceValue(selectionFocus.r, curCol.key, newVal);
            setMessage('Replaced 1 instance');
            handleFindNext();
        } else {
            handleFindNext();
        }
    };

    const handleReplaceAllMatches = () => {
        const matches = findMatches();
        if (matches.length === 0) {
            setMessage('No matching cells found to replace');
            return;
        }

        onReplaceAll(findText, replaceText, matchCase, matchExact);
        setMessage(`Successfully replaced ${matches.length} instance(s)`);
    };

    return (
        <div className="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 font-sans">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            <Search size={16} />
                        </div>
                        <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                            {mode === 'replace' ? 'Find and Replace' : 'Find in Sheet'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-4 pt-2 border-b border-gray-200 dark:border-white/10 flex items-center gap-4 text-xs font-bold bg-gray-50/20 dark:bg-transparent">
                    <button
                        onClick={() => {
                            setMode('find');
                            setMessage('');
                        }}
                        className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                            mode === 'find'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Find
                    </button>
                    <button
                        onClick={() => {
                            setMode('replace');
                            setMessage('');
                        }}
                        className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                            mode === 'replace'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Replace
                    </button>
                </div>

                {/* Body Form */}
                <div className="p-4 space-y-3 text-xs">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                            Find what:
                        </label>
                        <input
                            ref={findInputRef}
                            type="text"
                            value={findText}
                            onChange={(e) => setFindText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleFindNext();
                                if (e.key === 'Escape') onClose();
                            }}
                            placeholder="Type search text…"
                            className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {mode === 'replace' && (
                        <div>
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
                                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* Match Options */}
                    <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={matchCase}
                                onChange={(e) => setMatchCase(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>Match case</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={matchExact}
                                onChange={(e) => setMatchExact(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>Match exact cell</span>
                        </label>
                    </div>

                    {/* Notification info */}
                    {message && (
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[11px] font-semibold flex items-center gap-1.5">
                            <Sparkles size={12} className="shrink-0" />
                            <span>{message}</span>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02] gap-2">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleFindPrev}
                            disabled={!findText}
                            className="px-2.5 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 transition cursor-pointer flex items-center gap-1"
                        >
                            <ChevronUp size={12} />
                            <span>Prev</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleFindNext}
                            disabled={!findText}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                        >
                            <span>Find Next</span>
                            <ChevronDown size={12} />
                        </button>
                    </div>

                    {mode === 'replace' && (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleReplaceCurrent}
                                disabled={!findText}
                                className="px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 disabled:opacity-40 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                                Replace
                            </button>
                            <button
                                type="button"
                                onClick={handleReplaceAllMatches}
                                disabled={!findText}
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
