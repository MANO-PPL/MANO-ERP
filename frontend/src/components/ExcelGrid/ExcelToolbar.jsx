import React, { useState, useRef, useEffect } from 'react';
import {
    Search,
    Plus,
    Trash2,
    Copy,
    Save,
    RotateCcw,
    Undo2,
    Redo2,
    RefreshCw,
    Check,
    ChevronDown,
    FileSpreadsheet,
    FileText,
    UploadCloud,
    ClipboardPaste,
    Download,
    Keyboard,
    X,
    Sparkles
} from 'lucide-react';

export const ExcelToolbar = ({
    entityName = 'Items',
    searchTerm,
    setSearchTerm,
    hasUnsavedChanges,
    unsavedCount,
    isSaving,
    lastSavedTime,
    onSave,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onAddRows,
    selectedIds = new Set(),
    onBulkDelete,
    onBulkDuplicate,
    onClearSelection,
    onOpenImportModal,
    onDownloadTemplate,
    onExportCSV,
    onExportExcel,
    onOpenShortcutsModal,
    onOpenAddColumn,
    canWrite = true,
    customActions = null,
    bulkActions = null,
    extraFilters = null
}) => {
    const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
    const [isExcelDropdownOpen, setIsExcelDropdownOpen] = useState(false);
    const addDropdownRef = useRef(null);
    const excelDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (addDropdownRef.current && !addDropdownRef.current.contains(e.target)) {
                setIsAddDropdownOpen(false);
            }
            if (excelDropdownRef.current && !excelDropdownRef.current.contains(e.target)) {
                setIsExcelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="px-3 py-1.5 flex flex-wrap items-center justify-between border-b border-gray-200 dark:border-white/5 shrink-0 gap-3 bg-white dark:bg-[#0d1117] transition-colors select-none">
            {/* Left Section: Save Changes Button & Sync Status */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving || !hasUnsavedChanges || !canWrite}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        isSaving
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 cursor-wait'
                            : hasUnsavedChanges && canWrite
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-[0.98] cursor-pointer'
                            : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-white/10'
                    }`}
                    title={hasUnsavedChanges ? 'Click to save all pending changes to cloud' : 'All changes saved'}
                >
                    {isSaving ? (
                        <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Saving...</span>
                        </>
                    ) : hasUnsavedChanges ? (
                        <>
                            <Save size={13} className="stroke-[2.5]" />
                            <span>Save Changes ({unsavedCount})</span>
                            <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
                        </>
                    ) : (
                        <>
                            <Check size={13} className="stroke-[2.5] text-emerald-500" />
                            <span>All Changes Saved</span>
                            {lastSavedTime && (
                                <span className="text-[10px] text-gray-400 font-normal">({lastSavedTime})</span>
                            )}
                        </>
                    )}
                </button>

                {/* Undo / Redo */}
                {canWrite && (
                    <div className="flex items-center gap-0.5 border-l border-gray-200 dark:border-white/10 pl-2">
                        <button
                            type="button"
                            onClick={onUndo}
                            disabled={!canUndo}
                            className="p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            title="Undo (Ctrl+Z)"
                        >
                            <Undo2 size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={onRedo}
                            disabled={!canRedo}
                            className="p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            title="Redo (Ctrl+Y)"
                        >
                            <Redo2 size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Middle Section: Custom Extra Filters */}
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-start">
                {extraFilters}
            </div>

            {/* Right Section: Search, Bulk Operations, Custom Actions, Add Row & Excel Tools */}
            <div className="flex items-center gap-2 ml-auto">
                {/* Search Bar placed near tools */}
                <div className="relative w-44 sm:w-56">
                    <Search
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <input
                        type="text"
                        placeholder={`Search ${entityName.toLowerCase()}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Bulk Actions Menu (when rows are selected via checkbox) */}
                {selectedIds.size > 0 ? (
                    <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 px-2 py-1 rounded-lg animate-in fade-in">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                            {selectedIds.size} Selected
                        </span>
                        {canWrite && onBulkDuplicate && (
                            <button
                                type="button"
                                onClick={onBulkDuplicate}
                                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800/40 rounded text-blue-700 dark:text-blue-300 transition cursor-pointer"
                                title="Duplicate Selected"
                            >
                                <Copy size={13} />
                            </button>
                        )}
                        {canWrite && onBulkDelete && (
                            <button
                                type="button"
                                onClick={onBulkDelete}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded text-red-600 dark:text-red-400 transition cursor-pointer"
                                title="Delete Selected"
                            >
                                <Trash2 size={13} />
                            </button>
                        )}
                        {bulkActions}
                        <button
                            type="button"
                            onClick={onClearSelection}
                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800/40 rounded text-gray-500 dark:text-gray-400 transition cursor-pointer"
                            title="Clear Selection"
                        >
                            <X size={13} />
                        </button>
                    </div>
                ) : null}

                {/* Custom Page Actions */}
                {customActions}

                {/* + Add Row Button & Dropdown */}
                {canWrite && onAddRows && (
                    <div className="relative inline-flex" ref={addDropdownRef}>
                        <button
                            type="button"
                            onClick={() => onAddRows(1)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-l-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                        >
                            <Plus size={13} className="stroke-[3]" />
                            <span>Add Row</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                            className="px-1.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-r-lg border-l border-blue-500/40 transition-colors cursor-pointer"
                            title="Add multiple rows"
                        >
                            <ChevronDown size={12} />
                        </button>

                        {isAddDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-50 py-1 text-xs text-gray-700 dark:text-gray-200 font-semibold animate-in fade-in zoom-in-95">
                                <button
                                    onClick={() => {
                                        onAddRows(1);
                                        setIsAddDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                                >
                                    <Plus size={12} /> +1 Row
                                </button>
                                <button
                                    onClick={() => {
                                        onAddRows(5);
                                        setIsAddDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                                >
                                    <Plus size={12} /> +5 Rows
                                </button>
                                <button
                                    onClick={() => {
                                        onAddRows(10);
                                        setIsAddDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                                >
                                    <Plus size={12} /> +10 Rows
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Excel Tools Dropdown (Import, Export, Template, Shortcuts) */}
                <div className="relative inline-flex" ref={excelDropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsExcelDropdownOpen(!isExcelDropdownOpen)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                        <FileSpreadsheet size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Excel Tools</span>
                        <ChevronDown
                            size={11}
                            className={`transition-transform duration-200 ${isExcelDropdownOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {isExcelDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-50 py-1 text-xs text-gray-700 dark:text-gray-200 font-sans animate-in fade-in zoom-in-95">
                            {canWrite && onOpenAddColumn && (
                                <button
                                    onClick={() => {
                                        onOpenAddColumn();
                                        setIsExcelDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 font-semibold text-blue-600 dark:text-blue-400 cursor-pointer"
                                >
                                    <Plus size={13} className="stroke-[2.5]" />
                                    <span>Add Custom Column</span>
                                </button>
                            )}

                            {canWrite && onOpenImportModal && (
                                <>
                                    <button
                                        onClick={() => {
                                            onOpenImportModal('upload');
                                            setIsExcelDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200 cursor-pointer"
                                    >
                                        <UploadCloud size={13} className="text-blue-500" />
                                        <span>Import Spreadsheet (.xlsx, .csv)</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            onOpenImportModal('paste');
                                            setIsExcelDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200 cursor-pointer"
                                    >
                                        <ClipboardPaste size={13} className="text-purple-500" />
                                        <span>Paste from Excel Textarea</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (onDownloadTemplate) onDownloadTemplate();
                                            setIsExcelDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 text-gray-600 dark:text-gray-400 cursor-pointer"
                                    >
                                        <Download size={13} className="text-emerald-500" />
                                        <span>Download Template (.xlsx)</span>
                                    </button>
                                    <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
                                </>
                            )}

                            {onExportExcel && (
                                <button
                                    onClick={() => {
                                        onExportExcel();
                                        setIsExcelDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                >
                                    <FileSpreadsheet size={13} />
                                    <span>Export Excel (.xlsx)</span>
                                </button>
                            )}

                            {onExportCSV && (
                                <button
                                    onClick={() => {
                                        onExportCSV();
                                        setIsExcelDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer"
                                >
                                    <FileText size={13} className="text-blue-500" />
                                    <span>Export CSV (.csv)</span>
                                </button>
                            )}

                            {onOpenShortcutsModal && (
                                <>
                                    <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
                                    <button
                                        onClick={() => {
                                            onOpenShortcutsModal();
                                            setIsExcelDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 text-gray-600 dark:text-gray-400 cursor-pointer"
                                    >
                                        <Keyboard size={13} className="text-amber-500" />
                                        <span>Keyboard Shortcuts Help</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExcelToolbar;
