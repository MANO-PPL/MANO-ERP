import React from 'react';
import { Keyboard, X, MousePointer, Command, Zap, Layers } from 'lucide-react';

const SHORTCUT_CATEGORIES = [
    {
        title: 'Cell Navigation',
        icon: Command,
        shortcuts: [
            { key: 'Arrow Keys', desc: 'Move active cell selection (Up, Down, Left, Right)' },
            { key: 'Tab / Shift+Tab', desc: 'Move to next / previous column with automatic row wrap' },
            { key: 'Enter / Shift+Enter', desc: 'Move down / up (or commit edit and move)' },
            { key: 'Ctrl + Arrow Keys', desc: 'Jump directly to edge of table boundary' },
            { key: 'Home / End', desc: 'Jump to first / last column in current row' },
            { key: 'Ctrl + Home / End', desc: 'Jump to top-left (first cell) / bottom-right (last cell)' },
            { key: 'PageUp / PageDown', desc: 'Jump 10 rows up / down' },
            { key: 'Alt + PageUp/Down', desc: 'Jump 5 columns left / right' }
        ]
    },
    {
        title: 'Selection & Mouse Actions',
        icon: MousePointer,
        shortcuts: [
            { key: 'Click', desc: 'Select single cell' },
            { key: 'Shift + Click', desc: 'Select range of cells from active cell to clicked cell' },
            { key: 'Click & Drag', desc: 'Drag rectangle across cells to select range' },
            { key: 'Shift + Arrow Keys', desc: 'Expand or contract cell selection range box' },
            { key: 'Ctrl + Shift + Arrows', desc: 'Expand range selection to edge of table' },
            { key: 'Shift + Space', desc: 'Select entire current row(s)' },
            { key: 'Ctrl + Space', desc: 'Select entire current column(s)' },
            { key: 'Ctrl + A', desc: 'Select entire spreadsheet table' },
            { key: 'Drag Column Border', desc: 'Manually drag column header boundary to resize width' },
            { key: 'Double-Click Header', desc: 'Auto-fit column width to content length' }
        ]
    },
    {
        title: 'Cell Editing & Formatting',
        icon: Zap,
        shortcuts: [
            { key: 'F2 / Type Character', desc: 'Enter inline cell editing mode' },
            { key: 'Alt + Enter', desc: 'Insert line break / newline inside multiline text' },
            { key: 'Escape', desc: 'Cancel cell editing without saving or clear selection' },
            { key: 'Delete / Backspace', desc: 'Clear contents of selected cells (or delete row)' },
            { key: "Ctrl + ' (or \")", desc: 'Copy value from cell directly above' },
            { key: 'Ctrl + ; (or :)', desc: 'Insert Date Stamp (today’s date in YYYY-MM-DD)' },
            { key: 'Ctrl + Shift + :', desc: 'Insert Time Stamp (current time in HH:MM:SS)' },
            { key: 'Ctrl + U', desc: 'Convert selected cells text to UPPERCASE' },
            { key: 'Ctrl + L', desc: 'Convert selected cells text to lowercase' },
            { key: 'Ctrl + K', desc: 'Convert selected cells text to Title Case' }
        ]
    },
    {
        title: 'Clipboard, History & Rows',
        icon: Keyboard,
        shortcuts: [
            { key: 'Ctrl + C', desc: 'Copy selected cell(s) / row(s) to clipboard as TSV' },
            { key: 'Ctrl + X', desc: 'Cut selected cell(s) and clear contents' },
            { key: 'Ctrl + V', desc: 'Paste copied cells with smart 1D/2D range replication' },
            { key: 'Ctrl + Z', desc: 'Undo last action (edits, paste, fill, delete)' },
            { key: 'Ctrl + Y / Ctrl+Shift+Z', desc: 'Redo previously undone action' },
            { key: 'Ctrl + D', desc: 'Fill Down top row values across selected rows' },
            { key: 'Ctrl + R', desc: 'Fill Right leftmost column values across selected cols' },
            { key: 'Drag Fill Handle', desc: 'Drag blue corner square down to fill values into range' },
            { key: 'Double-Click Handle', desc: 'Auto-fill values all the way down to table bottom' },
            { key: 'Ctrl + H / Ctrl + F', desc: 'Open Find and Replace modal' },
            { key: 'Ctrl + + / Insert', desc: 'Insert new draft row below' },
            { key: 'Ctrl + -', desc: 'Delete active selected row(s)' },
            { key: 'Shift + F10 / Right Click', desc: 'Open spreadsheet Context Menu at active cell' }
        ]
    }
];

export const ExcelShortcutsModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 font-sans">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <Keyboard size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                Complete Excel & Spreadsheet Keyboard Shortcuts
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Full reference for keyboard navigation, editing, shortcuts, and mouse gestures
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SHORTCUT_CATEGORIES.map((cat, idx) => {
                            const Icon = cat.icon;
                            return (
                                <div
                                    key={idx}
                                    className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.01] space-y-2.5"
                                >
                                    <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                                        <Icon size={14} />
                                        <span>{cat.title}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {cat.shortcuts.map((sc, sIdx) => (
                                            <div
                                                key={sIdx}
                                                className="flex items-start justify-between gap-2 text-xs py-0.5"
                                            >
                                                <span className="text-gray-600 dark:text-gray-400 text-[11px] leading-tight">
                                                    {sc.desc}
                                                </span>
                                                <kbd className="shrink-0 px-2 py-0.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded font-mono text-[10px] text-gray-800 dark:text-gray-200 shadow-2xs font-bold">
                                                    {sc.key}
                                                </kbd>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                    <span className="text-[11px] text-gray-400">
                        Tip: Press <kbd className="font-mono bg-gray-200 dark:bg-white/10 px-1 py-0.5 rounded text-[10px]">F1</kbd> anytime to open this shortcut reference.
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExcelShortcutsModal;
