import React, { useState, useEffect } from 'react';
import {
    FileSpreadsheet,
    Plus,
    Upload,
    Sparkles,
    FolderOpen,
    Clock,
    Trash2,
    Copy,
    Download,
    Search,
    ChevronRight,
    ArrowLeft
} from 'lucide-react';
import SpreadsheetViewer from '../../../components/common/Spreadsheet/SpreadsheetViewer';
import ConfirmModal from '../../../components/ConfirmModal';
import {
    getConstructionTemplates,
    getSavedWorkbooksList,
    saveWorkbook,
    deleteWorkbook,
    importFromFile
} from '../../../utils/spreadsheetConverters';
import { customToast } from '../../../utils/toast';

const ProjectSpreadsheets = ({
    project,
    user,
    canWrite = true,
    setExtraBreadcrumbs
}) => {
    const projId = project?.id;
    const projName = project?.name || 'Project Workspace';
    const projCode = project?.project_code || 'PRJ';
    const templates = getConstructionTemplates(projName, projCode);

    const [savedList, setSavedList] = useState([]);
    const [activeWbId, setActiveWbId] = useState(null);
    const [viewMode, setViewMode] = useState('hub'); // 'hub' | 'editor'
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [wbToDelete, setWbToDelete] = useState(null);
    const fileInputRef = React.useRef(null);

    const refreshList = () => {
        if (!projId) return;
        const list = getSavedWorkbooksList(projId);
        setSavedList(list);
    };

    useEffect(() => {
        refreshList();
    }, [projId]);

    // Update breadcrumbs when switching views
    useEffect(() => {
        if (setExtraBreadcrumbs) {
            if (viewMode === 'editor') {
                const currentWb = savedList.find(w => w.id === activeWbId);
                setExtraBreadcrumbs([
                    {
                        label: currentWb ? currentWb.name : 'Active Spreadsheet',
                        onClick: () => {}
                    }
                ]);
            } else {
                setExtraBreadcrumbs([]);
            }
        }
    }, [viewMode, activeWbId, savedList, setExtraBreadcrumbs]);

    const handleCreateTemplate = (template) => {
        if (!canWrite) {
            customToast.warning('You have view-only access to Project Spreadsheets.', 'Permissions');
            return;
        }
        const newWb = {
            id: `wb_proj_${projId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: `${projCode} - ${template.name}`,
            sheets: template.sheets,
            templateId: template.id
        };

        const res = saveWorkbook(newWb, projId);
        if (res.success) {
            setActiveWbId(res.workbook.id);
            setViewMode('editor');
            refreshList();
            customToast.success(`Initialized "${res.workbook.name}" with project formulas.`, 'Worksheet Created');
        }
    };

    const handleOpenWorkbook = (wbId) => {
        setActiveWbId(wbId);
        setViewMode('editor');
    };

    const handleDeleteClick = (wb, e) => {
        e.stopPropagation();
        if (!canWrite) {
            customToast.warning('You have view-only access to this project.', 'Permissions');
            return;
        }
        setWbToDelete(wb);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!wbToDelete) return;
        deleteWorkbook(wbToDelete.id, projId);
        refreshList();
        customToast.success(`"${wbToDelete.name}" deleted successfully.`, 'Workbook Deleted');
        setDeleteModalOpen(false);
        setWbToDelete(null);
    };

    const handleDuplicate = (wbId, e) => {
        e.stopPropagation();
        if (!canWrite) {
            customToast.warning('You have view-only access to this project.', 'Permissions');
            return;
        }
        const saved = JSON.parse(localStorage.getItem(`mano_spreadsheet_wb_${wbId}`) || '{}');
        if (!saved || !saved.sheets) return;

        const newWb = {
            id: `wb_proj_${projId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: `${saved.name} (Copy)`,
            sheets: saved.sheets,
            templateId: saved.templateId || 'custom'
        };

        const res = saveWorkbook(newWb, projId);
        if (res.success) {
            refreshList();
            customToast.success(`Duplicated "${newWb.name}"`, 'Project Spreadsheets');
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!canWrite) {
            customToast.warning('You have view-only access to Project Spreadsheets.', 'Permissions');
            return;
        }

        try {
            customToast.info('Importing spreadsheet for this project...', 'Project Spreadsheets');
            const parsed = await importFromFile(file);
            if (parsed.success && parsed.sheets) {
                const newWb = {
                    id: `wb_proj_${projId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    name: `${projCode} - ${parsed.workbookName || file.name.replace(/\.[^/.]+$/, '')}`,
                    sheets: parsed.sheets,
                    templateId: 'imported'
                };
                const res = saveWorkbook(newWb, projId);
                if (res.success) {
                    setActiveWbId(res.workbook.id);
                    setViewMode('editor');
                    refreshList();
                    customToast.success(`Imported "${res.workbook.name}" successfully!`, 'Project Spreadsheets');
                }
            }
        } catch (err) {
            customToast.error('Import failed: ' + err.message, 'Project Spreadsheets');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const filteredList = savedList.filter(item =>
        (item.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (viewMode === 'editor') {
        return (
            <div className="w-full flex-1 flex flex-col min-h-[calc(100vh-140px)]">
                <SpreadsheetViewer
                    key={`viewer_proj_${activeWbId}`}
                    initialWorkbookId={activeWbId}
                    projectId={projId}
                    projectName={projName}
                    projectCode={projCode}
                    readOnly={!canWrite}
                    onBack={() => {
                        refreshList();
                        setViewMode('hub');
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex-1 w-full p-2.5 md:p-3.5 space-y-3 bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 overflow-y-auto">
            {/* Top Compact Actions Bar */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gh-border">
                <div className="flex items-center space-x-2">
                    {!canWrite && (
                        <span className="px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            View Only
                        </span>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    {canWrite && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImport}
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-[#161b22] border border-gray-300 dark:border-gh-border hover:bg-gray-50 dark:hover:bg-[#21262d] rounded-sm shadow-xs transition cursor-pointer"
                            >
                                <Upload size={14} className="text-emerald-600 dark:text-emerald-400" />
                                <span>Import Excel</span>
                            </button>
                            <button
                                onClick={() => handleCreateTemplate(templates[0])}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-sm shadow-sm shadow-blue-500/20 transition cursor-pointer"
                            >
                                <Plus size={14} />
                                <span>New Project Sheet</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Quick Starters Grid */}
            <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {templates.map((tpl) => (
                        <div
                            key={tpl.id}
                            onClick={() => handleCreateTemplate(tpl)}
                            className="group flex flex-col justify-between p-3 rounded-sm border border-gray-200/80 dark:border-gray-800 bg-gray-50/50 dark:bg-[#161b22] hover:border-blue-500/60 dark:hover:border-blue-500/60 hover:shadow-sm transition-all duration-150 cursor-pointer relative"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-1.5 rounded-sm bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                        <FileSpreadsheet size={16} />
                                    </div>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${tpl.badgeColor}`}>
                                        {tpl.badge}
                                    </span>
                                </div>
                                <h4 className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {tpl.name}
                                </h4>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                                    {tpl.description}
                                </p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                <span>Create Sheet</span>
                                <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Saved Project Workbooks (No enclosing background card) */}
            <div className="space-y-2.5 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gh-border">
                    <div className="flex items-center space-x-2">
                        <FolderOpen size={16} className="text-blue-600 dark:text-blue-400" />
                        <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                            Project Workbooks ({savedList.length})
                        </h3>
                    </div>

                    <div className="relative w-full sm:w-60">
                        <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter project sheets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-7 pr-2.5 py-1 text-xs bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-sm outline-none focus:border-blue-500 transition text-gray-900 dark:text-gray-100"
                        />
                    </div>
                </div>

                {filteredList.length === 0 ? (
                    <div className="text-center py-10">
                        <FileSpreadsheet size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {searchQuery ? 'No matching project sheets found' : 'No project spreadsheets created yet'}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs mx-auto">
                            Click a template above to generate an initial BOQ, Cost Estimator, or Material Sheet for this project.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 pt-0.5">
                        {filteredList.map((wb) => (
                            <div
                                key={wb.id}
                                onClick={() => handleOpenWorkbook(wb.id)}
                                className="group flex flex-col justify-between p-3 rounded-sm border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#161b22] hover:border-blue-500/60 dark:hover:border-blue-500/60 hover:shadow-sm transition cursor-pointer"
                            >
                                <div>
                                    <div className="flex items-center space-x-2 truncate">
                                        <div className="p-1.5 rounded-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                            <FileSpreadsheet size={15} />
                                        </div>
                                        <span className="font-semibold text-xs text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {wb.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2 mt-2 text-[11px] text-gray-400">
                                        <span className="px-1.5 py-0.5 rounded-xs bg-gray-200/60 dark:bg-gray-700/60 text-[10px] font-medium">
                                            {wb.sheetCount || 1} sheet{wb.sheetCount > 1 ? 's' : ''}
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center text-[10px]">
                                            <Clock size={10} className="mr-1" />
                                            {new Date(wb.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-gray-200/60 dark:border-gray-700/60 text-xs">
                                    <span className="text-blue-600 dark:text-blue-400 font-semibold group-hover:underline flex items-center text-[11px]">
                                        Open Sheet <ChevronRight size={12} className="ml-0.5" />
                                    </span>
                                    <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={(e) => handleDuplicate(wb.id, e)}
                                            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700 rounded-sm transition"
                                            title="Duplicate"
                                        >
                                            <Copy size={13} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteClick(wb, e)}
                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-sm transition"
                                            title="Delete"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Confirm Delete Popup Modal */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setWbToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Delete Project Spreadsheet"
                message={`Are you sure you want to permanently delete "${wbToDelete?.name || 'this spreadsheet'}" from ${projName}? This action cannot be undone.`}
                confirmText="Delete Spreadsheet"
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    );
};

export default ProjectSpreadsheets;
