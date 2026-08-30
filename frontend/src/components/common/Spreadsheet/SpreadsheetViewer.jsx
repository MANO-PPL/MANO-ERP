import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import './spreadsheet-theme.css';
import {
    FileSpreadsheet,
    Save,
    Download,
    Upload,
    Maximize2,
    Minimize2,
    Plus,
    FolderOpen,
    Trash2,
    Copy,
    Check,
    HelpCircle,
    RotateCcw,
    Sparkles,
    ChevronDown,
    FileText,
    Grid,
    Calendar,
    ArrowLeft,
    CheckCircle2,
    X,
    ExternalLink
} from 'lucide-react';
import ConfirmModal from '../../ConfirmModal';
import { customToast } from '../../../utils/toast';
import {
    exportToXLSX,
    exportToCSV,
    importFromFile,
    getConstructionTemplates,
    saveWorkbook,
    getSavedWorkbooksList,
    getWorkbookById,
    deleteWorkbook,
    registerCustomFonts
} from '../../../utils/spreadsheetConverters';
import { ExcelFormulaAssistantModal } from '../ExcelFormulas';

const SpreadsheetViewer = ({
    initialWorkbookId = null,
    projectId = null,
    projectName = 'Project Workspace',
    projectCode = 'PRJ-001',
    onBack = null,
    readOnly = false
}) => {
    const templates = getConstructionTemplates(projectName, projectCode);

    // Synchronously resolve workbook
    const getInitialWb = () => {
        if (initialWorkbookId) {
            const wb = getWorkbookById(initialWorkbookId);
            if (wb && wb.sheets && wb.sheets.length > 0) return wb;
        }
        const list = getSavedWorkbooksList(projectId);
        if (list.length > 0) {
            const latest = getWorkbookById(list[0].id);
            if (latest && latest.sheets && latest.sheets.length > 0) return latest;
        }
        return null;
    };

    const initialLoadedWb = getInitialWb();

    const [currentWbId, setCurrentWbId] = useState(() => {
        if (initialLoadedWb) return initialLoadedWb.id;
        if (initialWorkbookId) return initialWorkbookId;
        return `wb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    });

    const [workbookName, setWorkbookName] = useState(() => {
        if (initialLoadedWb) return initialLoadedWb.name;
        return `Blank Worksheet - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
    });

    const [sheetsData, setSheetsData] = useState(() => {
        if (initialLoadedWb && initialLoadedWb.sheets) return initialLoadedWb.sheets;
        return templates[0].sheets;
    });

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lastSaved, setLastSaved] = useState(() => initialLoadedWb?.updatedAt || null);
    const [isSaving, setIsSaving] = useState(false);
    const [showManagerModal, setShowManagerModal] = useState(false);
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);
    const [showFormulaHelp, setShowFormulaHelp] = useState(false);
    const [savedList, setSavedList] = useState([]);
    const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
    const [keyCounter, setKeyCounter] = useState(1);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [wbToDelete, setWbToDelete] = useState(null);

    const containerRef = useRef(null);
    const workbookRef = useRef(null);
    const fileInputRef = useRef(null);
    const autoSaveTimerRef = useRef(null);

    // Refresh saved workbooks list
    const refreshSavedList = useCallback(() => {
        const list = getSavedWorkbooksList(projectId);
        setSavedList(list);
    }, [projectId]);

    // Load initial workbook or default template
    useEffect(() => {
        registerCustomFonts();
        if (initialWorkbookId) {
            const wb = getWorkbookById(initialWorkbookId);
            if (wb && wb.sheets) {
                setCurrentWbId(wb.id);
                setWorkbookName(wb.name);
                setSheetsData(wb.sheets);
                setLastSaved(wb.updatedAt);
                setKeyCounter(k => k + 1);
            }
        } else if (!initialLoadedWb) {
            // Auto create initial blank worksheet if nothing exists
            const newWb = {
                id: currentWbId,
                name: workbookName,
                sheets: templates[0].sheets,
                templateId: 'blank'
            };
            const res = saveWorkbook(newWb, projectId);
            if (res.success) {
                setLastSaved(res.workbook.updatedAt);
            }
        }
        refreshSavedList();
    }, [initialWorkbookId, projectId, refreshSavedList]);

    // Handle FortuneSheet changes
    const handleSheetChange = useCallback((newSheets) => {
        if (readOnly) return;
        setSheetsData(newSheets);

        // Debounced auto-save
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = setTimeout(() => {
            if (currentWbId && !readOnly) {
                setIsSaving(true);
                const res = saveWorkbook({
                    id: currentWbId,
                    name: workbookName,
                    sheets: newSheets
                }, projectId);

                if (res.success) {
                    setLastSaved(new Date().toISOString());
                    refreshSavedList();
                } else {
                    console.error('Auto-save failed:', res.error);
                }
                setIsSaving(false);
            }
        }, 1500);
    }, [currentWbId, workbookName, projectId, readOnly, refreshSavedList]);

    // Explicit manual save
    const handleManualSave = () => {
        if (!currentWbId) return;
        setIsSaving(true);
        const res = saveWorkbook({
            id: currentWbId,
            name: workbookName,
            sheets: sheetsData
        }, projectId);

        if (res.success) {
            setLastSaved(new Date().toISOString());
            refreshSavedList();
            customToast.success('Workbook saved successfully', 'Spreadsheet');
        } else {
            customToast.error('Failed to save workbook', 'Spreadsheet');
        }
        setIsSaving(false);
    };

    // Load a specific workbook
    const handleLoadWorkbook = (id) => {
        const wb = getWorkbookById(id);
        if (wb && wb.sheets) {
            setCurrentWbId(wb.id);
            setWorkbookName(wb.name);
            setSheetsData(wb.sheets);
            setLastSaved(wb.updatedAt);
            setKeyCounter(k => k + 1);
            setShowManagerModal(false);
            customToast.info(`Loaded "${wb.name}".`, 'Spreadsheet');
        }
    };

    // Create a new workbook from template or blank
    const handleCreateFromTemplate = (template) => {
        const newWb = {
            id: `wb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: `${template.name} - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`,
            sheets: template.sheets,
            templateId: template.id
        };

        const res = saveWorkbook(newWb, projectId);
        if (res.success) {
            setCurrentWbId(res.workbook.id);
            setWorkbookName(res.workbook.name);
            setSheetsData(res.workbook.sheets);
            setLastSaved(res.workbook.updatedAt);
            setKeyCounter(k => k + 1);
            setShowTemplatesModal(false);
            setShowManagerModal(false);
            refreshSavedList();
            customToast.success(`Initialized "${res.workbook.name}" with formula models.`, 'Template Loaded');
        }
    };

    // Duplicate current workbook
    const handleDuplicateWorkbook = (wbId) => {
        const target = getWorkbookById(wbId || currentWbId);
        if (!target) return;

        const newWb = {
            id: `wb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: `${target.name} (Copy)`,
            sheets: target.sheets,
            templateId: target.templateId || 'custom'
        };

        const res = saveWorkbook(newWb, projectId);
        if (res.success) {
            refreshSavedList();
            customToast.success(`Created copy "${newWb.name}".`, 'Spreadsheet Duplicated');
        }
    };

    // Delete a workbook (Open confirmation popup)
    const handleDeleteWorkbookClick = (item, e) => {
        e?.stopPropagation();
        setWbToDelete(item);
        setDeleteModalOpen(true);
    };

    // Confirm delete execution
    const handleConfirmDeleteWorkbook = () => {
        if (!wbToDelete) return;
        const targetId = wbToDelete.id;
        deleteWorkbook(targetId, projectId);
        refreshSavedList();
        customToast.success(`"${wbToDelete.name}" deleted permanently.`, 'Spreadsheet Deleted');
        setDeleteModalOpen(false);
        setWbToDelete(null);

        // If deleted the active one, load another or create blank
        if (targetId === currentWbId) {
            const list = getSavedWorkbooksList(projectId);
            if (list.length > 0) {
                handleLoadWorkbook(list[0].id);
            } else {
                handleCreateFromTemplate(templates[0]);
            }
        }
    };

    // Import from file (.xlsx / .xls / .csv)
    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            customToast.info('Parsing spreadsheet file...', 'Spreadsheet');
            const parsed = await importFromFile(file);

            if (parsed.success && parsed.sheets) {
                const newWb = {
                    id: `wb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    name: parsed.workbookName || file.name.replace(/\.[^/.]+$/, ''),
                    sheets: parsed.sheets,
                    templateId: 'imported'
                };

                const res = saveWorkbook(newWb, projectId);
                if (res.success) {
                    setCurrentWbId(res.workbook.id);
                    setWorkbookName(res.workbook.name);
                    setSheetsData(res.workbook.sheets);
                    setLastSaved(res.workbook.updatedAt);
                    setKeyCounter(k => k + 1);
                    refreshSavedList();
                    customToast.success(`Imported "${res.workbook.name}" successfully!`, 'Spreadsheet');
                }
            }
        } catch (err) {
            console.error('Import error:', err);
            customToast.error('Failed to import file: ' + err.message, 'Spreadsheet');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Export to Excel .xlsx
    const handleExportXLSX = () => {
        setExportDropdownOpen(false);
        const result = exportToXLSX(sheetsData, `${workbookName}.xlsx`);
        if (result.success) {
            customToast.success(`Downloaded ${result.fileName}`, 'Spreadsheet');
        } else {
            customToast.error('Export failed: ' + result.error, 'Spreadsheet');
        }
    };

    // Export active sheet to CSV
    const handleExportCSV = () => {
        setExportDropdownOpen(false);
        const result = exportToCSV(sheetsData, 0, `${workbookName}.csv`);
        if (result.success) {
            customToast.success(`Downloaded ${result.fileName}`, 'Spreadsheet');
        } else {
            customToast.error('Export failed: ' + result.error, 'Spreadsheet');
        }
    };

    // Print
    const handlePrint = () => {
        setExportDropdownOpen(false);
        window.print();
    };

    // Toggle full screen
    const toggleFullscreen = () => {
        setIsFullscreen(prev => !prev);
    };

    return (
        <div
            ref={containerRef}
            className={`flex flex-col bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 transition-all ${
                isFullscreen
                    ? 'fixed inset-0 z-50 w-screen h-screen'
                    : 'w-full h-full min-h-[calc(100vh-100px)]'
            }`}
        >
            {/* Top Toolbar / Action Header */}
            <div className="flex flex-wrap items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gh-border bg-[#f8fafc] dark:bg-[#161b22] gap-2 shrink-0 select-none">
                {/* Left: Back / Title & Save status */}
                <div className="flex items-center space-x-2.5">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1 rounded-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#21262d] transition cursor-pointer"
                            title="Go Back"
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}

                    <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-sm bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <FileSpreadsheet size={16} />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={workbookName}
                                onChange={(e) => setWorkbookName(e.target.value)}
                                onBlur={handleManualSave}
                                disabled={readOnly}
                                className="font-bold text-xs bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:bg-white dark:focus:bg-[#0d1117] rounded-sm px-1 py-0.5 outline-none w-48 sm:w-64 md:w-80 truncate transition text-gray-900 dark:text-[#f0f6fc]"
                                title="Click to rename spreadsheet"
                            />
                            <div className="flex items-center space-x-1.5 px-1 text-[11px] text-gray-500 dark:text-gray-400">
                                {isSaving ? (
                                    <span className="flex items-center text-amber-600 dark:text-amber-400">
                                        <RotateCcw size={10} className="animate-spin mr-1" /> Saving changes...
                                    </span>
                                ) : lastSaved ? (
                                    <span className="flex items-center text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 size={10} className="mr-1" /> Saved {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                ) : (
                                    <span>Ready</span>
                                )}
                                {projectId && (
                                    <>
                                        <span>•</span>
                                        <span className="text-blue-600 dark:text-blue-400 font-medium truncate max-w-[130px]">
                                            {projectCode}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-1.5">
                    {/* Workbooks Manager */}
                    <button
                        onClick={() => {
                            refreshSavedList();
                            setShowManagerModal(true);
                        }}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-[#c9d1d9] bg-white dark:bg-[#21262d] border border-gray-300 dark:border-[#30363d] hover:bg-gray-50 dark:hover:bg-[#30363d] rounded-sm shadow-xs transition cursor-pointer"
                        title="View and manage all spreadsheets"
                    >
                        <FolderOpen size={13} className="text-blue-600 dark:text-blue-400" />
                        <span>Workbooks ({savedList.length})</span>
                    </button>

                    {/* Templates Button (Write only) */}
                    {!readOnly && (
                        <button
                            onClick={() => setShowTemplatesModal(true)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-sm transition cursor-pointer"
                            title="Choose a pre-built ERP template"
                        >
                            <Sparkles size={13} className="text-purple-600 dark:text-purple-400" />
                            <span>Templates</span>
                        </button>
                    )}

                    {/* Import Button (Write only) */}
                    {!readOnly && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImportFile}
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-[#c9d1d9] bg-white dark:bg-[#21262d] border border-gray-300 dark:border-[#30363d] hover:bg-gray-50 dark:hover:bg-[#30363d] rounded-sm shadow-xs transition cursor-pointer"
                                title="Upload Excel (.xlsx, .xls) or CSV file"
                            >
                                <Upload size={13} className="text-emerald-600 dark:text-emerald-400" />
                                <span>Import</span>
                            </button>
                        </>
                    )}

                    {/* Export Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setExportDropdownOpen(prev => !prev)}
                            className="inline-flex items-center space-x-1 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-sm shadow-xs transition cursor-pointer"
                        >
                            <Download size={13} />
                            <span>Export</span>
                            <ChevronDown size={12} className="opacity-80" />
                        </button>

                        {exportDropdownOpen && (
                            <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-sm shadow-xl py-1 z-50 text-xs text-gray-700 dark:text-[#c9d1d9] animate-in fade-in zoom-in-95">
                                <button
                                    onClick={handleExportXLSX}
                                    className="w-full flex items-center px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-[#21262d] text-left transition cursor-pointer"
                                >
                                    <FileSpreadsheet size={14} className="mr-2 text-emerald-600 dark:text-emerald-400" />
                                    <div>
                                        <div className="font-semibold text-gray-900 dark:text-white">Excel Workbook (.xlsx)</div>
                                        <div className="text-[10px] text-gray-400">Full multi-sheet workbook with formulas</div>
                                    </div>
                                </button>
                                <button
                                    onClick={handleExportCSV}
                                    className="w-full flex items-center px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-[#21262d] text-left transition cursor-pointer border-t border-gray-100 dark:border-[#30363d]/60"
                                >
                                    <FileText size={14} className="mr-2 text-blue-600 dark:text-blue-400" />
                                    <div>
                                        <div className="font-semibold text-gray-900 dark:text-white">CSV File (.csv)</div>
                                        <div className="text-[10px] text-gray-400">Active sheet comma-separated values</div>
                                    </div>
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="w-full flex items-center px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-[#21262d] text-left transition cursor-pointer border-t border-gray-100 dark:border-[#30363d]/60"
                                >
                                    <Maximize2 size={14} className="mr-2 text-purple-600 dark:text-purple-400" />
                                    <div>
                                        <div className="font-semibold text-gray-900 dark:text-white">Print / Save as PDF</div>
                                        <div className="text-[10px] text-gray-400">Browser print & PDF export</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Manual Save */}
                    {!readOnly && (
                        <button
                            onClick={handleManualSave}
                            disabled={isSaving}
                            className="p-1 rounded-sm text-gray-600 dark:text-[#c9d1d9] hover:text-gray-900 dark:hover:text-white bg-white dark:bg-[#21262d] border border-gray-300 dark:border-[#30363d] hover:bg-gray-50 dark:hover:bg-[#30363d] transition cursor-pointer"
                            title="Save changes now (Ctrl+S)"
                        >
                            <Save size={14} />
                        </button>
                    )}

                    {/* Formula Help */}
                    <button
                        onClick={() => setShowFormulaHelp(true)}
                        className="p-1 rounded-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#21262d] transition cursor-pointer"
                        title="Formula & Function Reference"
                    >
                        <HelpCircle size={15} />
                    </button>

                    {/* Fullscreen */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-1 rounded-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#21262d] transition cursor-pointer"
                        title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen Mode'}
                    >
                        {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                </div>
            </div>

            {/* Main Spreadsheet Canvas Workspace */}
            <div className="flex-1 w-full relative overflow-hidden bg-white dark:bg-[#0d1117]">
                <Workbook
                    key={`fs_wb_${currentWbId}_${keyCounter}`}
                    ref={workbookRef}
                    data={sheetsData}
                    onChange={handleSheetChange}
                    showToolbar={true}
                    showFormulaBar={true}
                    showSheetTabs={true}
                    showContextmenu={true}
                    showStatisticBar={true}
                    defaultFontSize={12}
                    defaultRowHeight={22}
                    defaultColWidth={86}
                    rowHeaderWidth={46}
                    columnHeaderHeight={24}
                    row={Math.max(sheetsData?.[0]?.row || 80, 80)}
                    column={Math.max(sheetsData?.[0]?.column || 30, 30)}
                    lang="en"
                    currency="₹"
                    allowEdit={!readOnly}
                />
            </div>

            {/* ─── MODAL 1: Workbooks Manager Drawer ─────────────────────────────────── */}
            {showManagerModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-sm shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/40">
                            <div className="flex items-center space-x-2">
                                <FolderOpen className="text-blue-600 dark:text-blue-400" size={18} />
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        Saved Workbooks
                                    </h3>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {projectId ? `Project: ${projectName}` : 'Global MANO-ERP Workbooks'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {!readOnly && (
                                    <button
                                        onClick={() => {
                                            setShowManagerModal(false);
                                            setShowTemplatesModal(true);
                                        }}
                                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-sm transition cursor-pointer"
                                    >
                                        <Plus size={13} />
                                        <span>New Sheet</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowManagerModal(false)}
                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-sm"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {savedList.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <FileSpreadsheet size={32} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-xs font-medium">No saved spreadsheets yet</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">Create a new spreadsheet or pick a template to get started</p>
                                </div>
                            ) : (
                                savedList.map(item => {
                                    const isCurrent = item.id === currentWbId;
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => handleLoadWorkbook(item.id)}
                                            className={`flex items-center justify-between p-2.5 rounded-sm border transition cursor-pointer ${
                                                isCurrent
                                                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20 dark:border-blue-500/60'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-2.5 truncate">
                                                <div className={`p-1.5 rounded-sm ${isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                                    <FileSpreadsheet size={16} />
                                                </div>
                                                <div className="truncate">
                                                    <div className="flex items-center space-x-1.5">
                                                        <span className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                                                            {item.name}
                                                        </span>
                                                        {isCurrent && (
                                                            <span className="text-[9px] px-1 py-0.2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-sm font-medium">
                                                                Active
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center space-x-1.5 mt-0.5">
                                                        <span>{item.sheetCount} sheet{item.sheetCount > 1 ? 's' : ''}</span>
                                                        <span>•</span>
                                                        <span>Updated {new Date(item.updatedAt).toLocaleDateString()} at {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {!readOnly && (
                                                <div className="flex items-center space-x-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => handleDuplicateWorkbook(item.id)}
                                                        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition"
                                                        title="Duplicate workbook"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteWorkbookClick(item, e)}
                                                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-sm transition"
                                                        title="Delete workbook"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL 2: Templates Picker ────────────────────────────────────────── */}
            {showTemplatesModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-sm shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/40">
                            <div className="flex items-center space-x-2">
                                <Sparkles className="text-purple-600 dark:text-purple-400" size={18} />
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        Construction & ERP Spreadsheet Templates
                                    </h3>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                        Select a ready-to-use template with automated formulas, styling, and headers
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTemplatesModal(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-sm"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 overflow-y-auto">
                            {templates.map(tpl => (
                                <div
                                    key={tpl.id}
                                    onClick={() => handleCreateFromTemplate(tpl)}
                                    className="flex flex-col justify-between p-3 rounded-sm border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-sm bg-white dark:bg-gray-800/60 transition group cursor-pointer"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="p-1.5 rounded-sm bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                                                <FileSpreadsheet size={16} />
                                            </div>
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm ${tpl.badgeColor}`}>
                                                {tpl.badge}
                                            </span>
                                        </div>
                                        <h4 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                            {tpl.name}
                                        </h4>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                                            {tpl.description}
                                        </p>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                                        <span>Use Template</span>
                                        <span>→</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL 3: Excel Formula Assistant & Interactive Calculator ──────── */}
            <ExcelFormulaAssistantModal
                isOpen={showFormulaHelp}
                onClose={() => setShowFormulaHelp(false)}
                onInsertFormula={(insertedFormula) => {
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(insertedFormula);
                    }
                    customToast.success(`Copied "${insertedFormula}" to clipboard. Click any cell to paste or type formulas.`, 'Formula Ready');
                }}
            />

            {/* ─── MODAL 4: Delete Workbook Confirmation ───────────────────────────── */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setWbToDelete(null);
                }}
                onConfirm={handleConfirmDeleteWorkbook}
                title="Delete Spreadsheet"
                message={`Are you sure you want to permanently delete "${wbToDelete?.name || 'this spreadsheet'}"? This action cannot be undone.`}
                confirmText="Delete Spreadsheet"
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    );
};

export default SpreadsheetViewer;
