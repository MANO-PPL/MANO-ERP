import React, { useState, useEffect } from 'react';
import { Keyboard, X, MousePointer, Command, Zap, Search } from 'lucide-react';

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
            { key: 'Ctrl + H / Ctrl + F', desc: 'Open Find and Replace widget' },
            { key: 'Ctrl + + / Insert', desc: 'Insert new draft row below' },
            { key: 'Ctrl + -', desc: 'Delete active selected row(s)' },
            { key: 'Shift + F10 / Right Click', desc: 'Open spreadsheet Context Menu at active cell' }
        ]
    }
];

export const ExcelShortcutsModal = ({ isOpen, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (onClose) onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const lowerQuery = searchQuery.toLowerCase().trim();

    const filteredCategories = SHORTCUT_CATEGORIES.map((cat) => {
        if (!lowerQuery) return cat;
        const matchingShortcuts = cat.shortcuts.filter(
            (sc) =>
                sc.key.toLowerCase().includes(lowerQuery) ||
                sc.desc.toLowerCase().includes(lowerQuery)
        );
        return { ...cat, shortcuts: matchingShortcuts };
    }).filter((cat) => cat.shortcuts.length > 0);

    return (
        <>
            {/* Backdrop Overlay */}
            <div
                className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-xs z-[5999] transition-all duration-300 ease-out"
                onClick={onClose}
            />

            {/* Right Slide-out Sidebar Drawer */}
            <div
                className="fixed top-0 right-0 h-full w-full max-w-lg md:max-w-xl bg-white dark:bg-[#161b22] shadow-2xl z-[6000] transform transition-transform duration-300 ease-out flex flex-col border-l border-gray-200 dark:border-white/10 overflow-hidden translate-x-0 font-sans"
            >
                {/* Header */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <Keyboard size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                                Keyboard Shortcuts & Gestures
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Excel-compatible keyboard navigation & mouse reference
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        title="Close (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#161b22]">
                    <div className="relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                            size={16}
                        />
                        <input
                            type="text"
                            placeholder="Search shortcuts (e.g. date, copy, undo, navigation)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-gray-400 font-medium"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
                    {filteredCategories.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                No shortcuts matching "{searchQuery}"
                            </p>
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                                Clear search filter
                            </button>
                        </div>
                    ) : (
                        filteredCategories.map((cat, idx) => {
                            const Icon = cat.icon;
                            return (
                                <div
                                    key={idx}
                                    className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.01] space-y-2.5"
                                >
                                    <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                                        <Icon size={15} />
                                        <span>{cat.title}</span>
                                    </div>
                                    <div className="divide-y divide-gray-100 dark:divide-white/5">
                                        {cat.shortcuts.map((sc, sIdx) => (
                                            <div
                                                key={sIdx}
                                                className="flex items-center justify-between gap-3 text-xs py-2 hover:bg-gray-100/50 dark:hover:bg-white/[0.02] px-1.5 rounded transition-colors"
                                            >
                                                <span className="text-gray-700 dark:text-gray-300 text-xs font-medium leading-tight">
                                                    {sc.desc}
                                                </span>
                                                <kbd className="shrink-0 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg font-mono text-[10px] text-gray-800 dark:text-gray-200 shadow-2xs font-bold whitespace-nowrap">
                                                    {sc.key}
                                                </kbd>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Tip: Press <kbd className="font-mono bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-bold">F1</kbd> anytime to open
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </>
    );
};

export default ExcelShortcutsModal;
