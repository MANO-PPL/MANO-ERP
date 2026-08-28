import React, { useEffect, useRef, useState } from 'react';
import {
    Scissors,
    Copy,
    Clipboard,
    ArrowDown,
    ArrowRight,
    Calendar,
    Clock,
    Plus,
    Trash2,
    Eraser,
    Sparkles,
    Type,
    ChevronRight
} from 'lucide-react';

export const ExcelContextMenu = ({
    contextMenu,
    onClose,
    onCut,
    onCopy,
    onPaste,
    onPasteValuesOnly,
    onFillDown,
    onFillRight,
    onDateStamp,
    onTimeStamp,
    onTransformCase,
    onInsertRowAbove,
    onInsertRowBelow,
    onDuplicateRow,
    onDeleteRows,
    onClearCells,
    canWrite = true
}) => {
    const menuRef = useRef(null);
    const [activeSubmenu, setActiveSubmenu] = useState(null); // 'case' | 'paste-special'

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    if (!contextMenu) return null;

    const { x, y } = contextMenu;

    return (
        <div
            ref={menuRef}
            data-context-menu="true"
            style={{
                top: `${Math.min(y, window.innerHeight - 440)}px`,
                left: `${Math.min(x, window.innerWidth - 260)}px`
            }}
            className="fixed z-[9999] w-60 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-2xl py-1 text-xs text-gray-700 dark:text-gray-200 font-sans select-none animate-in fade-in zoom-in-95 duration-100"
        >
            {/* Clipboard Section */}
            <div className="px-1 py-0.5 space-y-0.5">
                {canWrite && (
                    <button
                        onClick={() => {
                            onCut();
                            onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <Scissors size={13} className="text-gray-500" />
                            <span>Cut</span>
                        </div>
                        <kbd className="text-[10px] font-mono text-gray-400">Ctrl+X</kbd>
                    </button>
                )}

                <button
                    onClick={() => {
                        onCopy();
                        onClose();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                >
                    <div className="flex items-center gap-2">
                        <Copy size={13} className="text-gray-500" />
                        <span>Copy</span>
                    </div>
                    <kbd className="text-[10px] font-mono text-gray-400">Ctrl+C</kbd>
                </button>

                {canWrite && (
                    <button
                        onClick={() => {
                            onPaste();
                            onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <Clipboard size={13} className="text-gray-500" />
                            <span>Paste</span>
                        </div>
                        <kbd className="text-[10px] font-mono text-gray-400">Ctrl+V</kbd>
                    </button>
                )}
            </div>

            {canWrite && <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />}

            {/* Excel Fill, Stamp & Case Section */}
            {canWrite && (
                <div className="px-1 py-0.5 space-y-0.5">
                    <button
                        onClick={() => {
                            onFillDown();
                            onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <ArrowDown size={13} className="text-blue-500" />
                            <span>Fill Down</span>
                        </div>
                        <kbd className="text-[10px] font-mono text-gray-400">Ctrl+D</kbd>
                    </button>

                    <button
                        onClick={() => {
                            onFillRight();
                            onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <ArrowRight size={13} className="text-blue-500" />
                            <span>Fill Right</span>
                        </div>
                        <kbd className="text-[10px] font-mono text-gray-400">Ctrl+R</kbd>
                    </button>

                    <button
                        onClick={() => {
                            onDateStamp();
                            onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <Calendar size={13} className="text-amber-500" />
                            <span>Insert Date Stamp</span>
                        </div>
                        <kbd className="text-[10px] font-mono text-gray-400">Ctrl+;</kbd>
                    </button>

                    <button
                        onClick={() => {
                            if (onTimeStamp) onTimeStamp();
                            onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={13} className="text-purple-500" />
                            <span>Insert Time Stamp</span>
                        </div>
                        <kbd className="text-[10px] font-mono text-gray-400">Ctrl+Shift+:</kbd>
                    </button>

                    {/* Change Case Submenu Trigger */}
                    <div
                        className="relative"
                        onMouseEnter={() => setActiveSubmenu('case')}
                        onMouseLeave={() => setActiveSubmenu(null)}
                    >
                        <div className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer">
                            <div className="flex items-center gap-2">
                                <Type size={13} className="text-indigo-500" />
                                <span>Change Case</span>
                            </div>
                            <ChevronRight size={12} className="text-gray-400" />
                        </div>

                        {activeSubmenu === 'case' && (
                            <div className="absolute left-full top-0 ml-1 w-44 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-2xl py-1 text-xs text-gray-700 dark:text-gray-200 z-[10000]">
                                <button
                                    onClick={() => {
                                        if (onTransformCase) onTransformCase('uppercase');
                                        onClose();
                                    }}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-left cursor-pointer"
                                >
                                    <span>UPPERCASE</span>
                                    <kbd className="text-[9px] font-mono text-gray-400">Ctrl+U</kbd>
                                </button>
                                <button
                                    onClick={() => {
                                        if (onTransformCase) onTransformCase('lowercase');
                                        onClose();
                                    }}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-left cursor-pointer"
                                >
                                    <span>lowercase</span>
                                    <kbd className="text-[9px] font-mono text-gray-400">Ctrl+L</kbd>
                                </button>
                                <button
                                    onClick={() => {
                                        if (onTransformCase) onTransformCase('titlecase');
                                        onClose();
                                    }}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-left cursor-pointer"
                                >
                                    <span>Title Case</span>
                                    <kbd className="text-[9px] font-mono text-gray-400">Ctrl+K</kbd>
                                </button>
                                <button
                                    onClick={() => {
                                        if (onTransformCase) onTransformCase('sentencecase');
                                        onClose();
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 cursor-pointer"
                                >
                                    Sentence case
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {canWrite && <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />}

            {/* Rows & Operations Section */}
            {canWrite && (
                <div className="px-1 py-0.5 space-y-0.5">
                    <button
                        onClick={() => {
                            onInsertRowAbove();
                            onClose();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                        <Plus size={13} className="text-emerald-500" />
                        <span>Insert Row Above</span>
                    </button>

                    <button
                        onClick={() => {
                            onInsertRowBelow();
                            onClose();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                        <Plus size={13} className="text-emerald-500" />
                        <span>Insert Row Below</span>
                    </button>

                    <button
                        onClick={() => {
                            onDuplicateRow();
                            onClose();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                        <Sparkles size={13} className="text-purple-500" />
                        <span>Duplicate Row</span>
                    </button>

                    <button
                        onClick={() => {
                            onClearCells();
                            onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <Eraser size={13} className="text-gray-500" />
                            <span>Clear Cells</span>
                        </div>
                        <kbd className="text-[10px] font-mono text-gray-400">Del</kbd>
                    </button>

                    <button
                        onClick={() => {
                            onDeleteRows();
                            onClose();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-md transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <Trash2 size={13} />
                            <span>Delete Row</span>
                        </div>
                        <kbd className="text-[10px] font-mono text-red-400">Ctrl+-</kbd>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ExcelContextMenu;
