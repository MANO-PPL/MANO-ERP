import React from 'react';
import {
    Plus,
    Copy,
    Trash2,
    Undo2,
    Redo2,
    RotateCcw,
    Save,
    Search,
    Table,
    ArrowLeft,
    Sparkles
} from 'lucide-react';

export const GridToolbar = ({
    entityName,
    searchTerm,
    setSearchTerm,
    onAddRow,
    onDuplicateRows,
    onDeleteRows,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    dirtyCounts,
    isSaving,
    onSaveBatch,
    onRevert,
    onBackToList
}) => {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 shadow-lg">
            {/* Left Section: Title & View Toggle */}
            <div className="flex items-center space-x-3">
                {onBackToList && (
                    <button
                        onClick={onBackToList}
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                        title="Back to Standard List View"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Standard View</span>
                    </button>
                )}

                <div className="flex items-center space-x-2 border-l border-slate-800 pl-3">
                    <div className="p-1.5 rounded-md bg-blue-900/40 text-blue-400">
                        <Table className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                            {entityName} Bulk Editor
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                                EXCEL MODE
                            </span>
                        </h3>
                    </div>
                </div>
            </div>

            {/* Middle Section: Search & Quick Actions */}
            <div className="flex items-center space-x-2">
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search grid..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                    />
                </div>

                <div className="h-4 w-px bg-slate-800" />

                <button
                    onClick={onAddRow}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium transition-colors"
                    title="Add new draft row at bottom"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Row</span>
                </button>

                <button
                    onClick={onDuplicateRows}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium transition-colors"
                    title="Duplicate selected row(s)"
                >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicate</span>
                </button>

                <button
                    onClick={onDeleteRows}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 rounded-md text-xs font-medium transition-colors"
                    title="Delete selected row(s)"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                </button>

                <div className="h-4 w-px bg-slate-800" />

                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400 rounded-md hover:bg-slate-800 transition-colors"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 className="w-3.5 h-3.5" />
                </button>

                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400 rounded-md hover:bg-slate-800 transition-colors"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Right Section: Batch Status & Save */}
            <div className="flex items-center space-x-3">
                {dirtyCounts.total > 0 && (
                    <div className="flex items-center space-x-1.5 text-xs font-mono">
                        <span className="text-slate-400">Unsaved:</span>
                        {dirtyCounts.created > 0 && (
                            <span className="text-emerald-400 font-semibold">+{dirtyCounts.created}</span>
                        )}
                        {dirtyCounts.updated > 0 && (
                            <span className="text-amber-400 font-semibold">~{dirtyCounts.updated}</span>
                        )}
                        {dirtyCounts.deleted > 0 && (
                            <span className="text-red-400 font-semibold">-{dirtyCounts.deleted}</span>
                        )}
                    </div>
                )}

                {dirtyCounts.total > 0 && (
                    <button
                        onClick={onRevert}
                        className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors"
                        title="Discard all pending changes"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Revert</span>
                    </button>
                )}

                <button
                    onClick={onSaveBatch}
                    disabled={isSaving || dirtyCounts.total === 0}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md text-xs font-semibold shadow-md transition-colors"
                >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : `Save Changes (${dirtyCounts.total})`}</span>
                </button>
            </div>
        </div>
    );
};
