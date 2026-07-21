import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Info, RefreshCw, Package, Layers, Users, X, Upload, Download, Save, RotateCcw, AlertCircle, ChevronDown } from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import ResourceDetail from './ResourceDetail';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { UNIT_REGISTRY, UNIT_OPTIONS, UNIT_GROUPS } from './resourceConstants';

const TYPE_CONFIG = {
    material: { label: 'Material', icon: Package, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    item: { label: 'Item', icon: Layers, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    labour: { label: 'Labour', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
};

const unitTypeLabel = { weight: 'Weight', volume: 'Volume', length: 'Length', area: 'Area', count: 'Count', time: 'Time' };

const ResourceList = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);
    
    // Original list from server
    const [resources, setResources] = useState([]);
    // Spreadsheet grid state
    const [gridData, setGridData] = useState([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');

    // Paste Modal State
    const [isPasting, setIsPasting] = useState(false);
    const [pastedText, setPastedText] = useState('');

    // Detail Panel Sidebar State
    const [viewingResource, setViewingResource] = useState(null);

    // Custom popups dropdown cell states
    const [activeDropdownCell, setActiveDropdownCell] = useState(null); // { rowIndex, colName }
    const [unitSearch, setUnitSearch] = useState('');
    const [editingCell, setEditingCell] = useState(null); // { rowIndex, colName }

    const closeDropdown = () => {
        setActiveDropdownCell(null);
        setUnitSearch('');
    };

    // Stats
    const stats = {
        total: resources.length,
        materials: resources.filter(r => r.type === 'material').length,
        items: resources.filter(r => r.type === 'item').length,
        labour: resources.filter(r => r.type === 'labour').length,
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const resData = await resourceApi.getResources();
            const fetchedList = resData.resources || [];
            
            setResources(fetchedList);
            
            // Rebuild grid: keep unsaved modifications or new rows, update saved ones
            setGridData(prevGrid => {
                const newUnsaved = prevGrid.filter(r => String(r.id).startsWith('temp_'));
                const modifiedMap = new Map(
                    prevGrid.filter(r => r._status === 'modified' || r._status === 'error').map(r => [r.id, r])
                );

                const updatedGrid = fetchedList.map(fetched => {
                    if (modifiedMap.has(fetched.id)) {
                        return modifiedMap.get(fetched.id);
                    }
                    return {
                        ...fetched,
                        _status: 'saved',
                        _errors: {}
                    };
                });

                return [...updatedGrid, ...newUnsaved];
            });

        } catch (error) {
            console.error('Failed to fetch resources', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter local grid data
    const filteredGridData = gridData.filter(r => {
        const matchesType = filterType ? r.type === filterType : true;
        const matchesSearch = (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesType && matchesSearch;
    });

    const pendingEditsCount = gridData.filter(r => r._status === 'new' || r._status === 'modified' || r._status === 'error').length;

    // ─── Cell Management ───────────────────────────────────────────────────────
    const handleCellChange = (rowIndex, field, value) => {
        setGridData(prev => {
            const updated = [...prev];
            const row = { ...updated[rowIndex] };
            
            row[field] = value;

            // Type changes can affect base units or compositions
            if (field === 'type' && value !== 'item') {
                row.compositions = [];
            }

            if (row._status !== 'new') {
                row._status = 'modified';
            }

            // Perform simple frontend validation
            const errors = { ...row._errors };
            if (field === 'name') {
                if (!value.trim()) errors.name = 'Name is required';
                else delete errors.name;
            }
            if (field === 'base_unit_code') {
                if (!value) errors.base_unit_code = 'Base unit is required';
                else delete errors.base_unit_code;
            }
            row._errors = errors;
            updated[rowIndex] = row;
            return updated;
        });
    };

    // ─── Keyboard Navigation ───────────────────────────────────────────────────
    const handleKeyDown = (e, rowIndex, colIndex) => {
        const columns = ['code', 'name', 'type', 'base_unit_code', 'description', 'remarks'];
        const totalRows = filteredGridData.length;
        const totalCols = columns.length;

        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            const nextRow = rowIndex + 1;
            if (nextRow < totalRows) {
                const nextEl = document.getElementById(`cell-${nextRow}-${columns[colIndex]}`);
                if (nextEl) nextEl.focus();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevRow = rowIndex - 1;
            if (prevRow >= 0) {
                const prevEl = document.getElementById(`cell-${prevRow}-${columns[colIndex]}`);
                if (prevEl) prevEl.focus();
            }
        } else if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (colIndex === 0 && rowIndex > 0) {
                    e.preventDefault();
                    const prevEl = document.getElementById(`cell-${rowIndex - 1}-${columns[totalCols - 1]}`);
                    if (prevEl) prevEl.focus();
                }
            } else {
                if (colIndex === totalCols - 1 && rowIndex < totalRows - 1) {
                    e.preventDefault();
                    const nextEl = document.getElementById(`cell-${rowIndex + 1}-${columns[0]}`);
                    if (nextEl) nextEl.focus();
                }
            }
        }
    };

    // ─── Add Row(s) ────────────────────────────────────────────────────────────
    const handleAddRows = (count = 1) => {
        const newRows = Array.from({ length: count }).map(() => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            code: '',
            name: '',
            type: 'material',
            base_unit_code: 'kg',
            description: '',
            remarks: '',
            _status: 'new',
            _errors: {}
        }));
        setGridData(prev => [...prev, ...newRows]);
    };

    // ─── Revert Row ─────────────────────────────────────────────────────────────
    const handleRevertRow = (rowIndex, row) => {
        if (row._status === 'new') {
            setGridData(prev => prev.filter(r => r.id !== row.id));
            return;
        }

        const original = resources.find(r => r.id === row.id);
        if (original) {
            setGridData(prev => {
                const updated = [...prev];
                updated[rowIndex] = {
                    ...original,
                    _status: 'saved',
                    _errors: {}
                };
                return updated;
            });
        }
    };

    // ─── Discard All ────────────────────────────────────────────────────────────
    const handleDiscardChanges = () => {
        if (!window.confirm('Discard all unsaved edits and added rows?')) return;
        setGridData(resources.map(r => ({
            ...r,
            _status: 'saved',
            _errors: {}
        })));
        setSaveError('');
    };

    // ─── Delete Row ─────────────────────────────────────────────────────────────
    const handleDeleteRow = async (row) => {
        if (row._status === 'new') {
            setGridData(prev => prev.filter(r => r.id !== row.id));
            return;
        }

        if (!window.confirm(`Are you sure you want to delete "${row.name}"?`)) return;
        try {
            await resourceApi.deleteResource(row.id);
            setResources(prev => prev.filter(r => r.id !== row.id));
            setGridData(prev => prev.filter(r => r.id !== row.id));
            if (viewingResource === row.id) {
                setViewingResource(null);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete resource');
        }
    };

    // ─── Save Batch ─────────────────────────────────────────────────────────────
    const handleSaveChanges = async () => {
        setIsSaving(true);
        setSaveError('');

        const newRows = gridData.filter(r => r._status === 'new');
        const modifiedRows = gridData.filter(r => r._status === 'modified' || r._status === 'error');

        try {
            // Client side validation check
            let validationError = false;
            const validated = gridData.map(row => {
                if (row._status === 'new' || row._status === 'modified' || row._status === 'error') {
                    const errors = {};
                    if (!row.name || !row.name.trim()) errors.name = 'Name is required';
                    if (!row.base_unit_code) errors.base_unit_code = 'Base unit is required';
                    
                    if (Object.keys(errors).length > 0) {
                        validationError = true;
                        return { ...row, _status: 'error', _errors: errors };
                    }
                }
                return row;
            });

            if (validationError) {
                setGridData(validated);
                throw new Error('Please fix input validations before saving.');
            }

            // Save new rows in batch
            if (newRows.length > 0) {
                const cleanPayload = newRows.map(({ id, _status, _errors, ...rest }) => rest);
                await resourceApi.bulkCreateResources(cleanPayload);
            }

            // Save modified rows in batch
            if (modifiedRows.length > 0) {
                const cleanPayload = modifiedRows.map(({ _status, _errors, base_unit_name, base_unit_symbol, ...rest }) => rest);
                await resourceApi.bulkUpdateResources(cleanPayload);
            }

            // Refresh data
            await fetchData();
        } catch (err) {
            console.error('Failed to save grid changes', err);
            setSaveError(err.response?.data?.message || err.message || 'Failed to save changes');
            
            // Map server transactional errors back to grid rows if detailed
            const serverReport = err.response?.data?.report;
            if (serverReport && serverReport.errors) {
                const updatedGrid = [...gridData];
                serverReport.errors.forEach(errInfo => {
                    const idx = errInfo.index;
                    if (newRows.length > 0) {
                        const targetRow = newRows[idx];
                        if (targetRow) {
                            const gridIdx = updatedGrid.findIndex(r => r.id === targetRow.id);
                            if (gridIdx !== -1) {
                                updatedGrid[gridIdx]._status = 'error';
                                updatedGrid[gridIdx]._errors = { server: errInfo.error };
                            }
                        }
                    }
                });
                setGridData(updatedGrid);
            }
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Import Paste Parsing ──────────────────────────────────────────────────
    const handlePasteImport = () => {
        if (!pastedText.trim()) {
            setIsPasting(false);
            return;
        }

        const lines = pastedText.split(/\r?\n/);
        const parsedRows = [];

        lines.forEach(line => {
            if (!line.trim()) return;
            const cells = line.split('\t');

            // Skip headers
            const firstCellLower = cells[0]?.toLowerCase().trim();
            if (firstCellLower === 'name' || firstCellLower === 'code' || firstCellLower === 'type' || firstCellLower === 'description') {
                return;
            }

            let code = '';
            let name = '';
            let type = 'material';
            let base_unit_code = 'kg';
            let description = '';
            let remarks = '';

            // Grid order copy paste: Code, Name, Type, Base Unit, Description, Remarks
            if (cells.length > 0) code = cells[0]?.trim() || '';
            if (cells.length > 1) name = cells[1]?.trim() || '';
            if (cells.length > 2) {
                const rawType = cells[2]?.trim().toLowerCase();
                if (['material', 'item', 'labour'].includes(rawType)) {
                    type = rawType;
                } else if (rawType === 'composite' || rawType === 'item') {
                    type = 'item';
                }
            }
            if (cells.length > 3) {
                const rawUnit = cells[3]?.trim();
                const foundUnit = Object.entries(UNIT_REGISTRY).find(([uCode, meta]) => 
                    uCode.toLowerCase() === rawUnit.toLowerCase() || 
                    meta.symbol.toLowerCase() === rawUnit.toLowerCase() || 
                    meta.name.toLowerCase() === rawUnit.toLowerCase()
                );
                if (foundUnit) base_unit_code = foundUnit[0];
            }
            if (cells.length > 4) description = cells[4]?.trim() || '';
            if (cells.length > 5) remarks = cells[5]?.trim() || '';

            if (code && !name) {
                name = code;
                code = '';
            }

            if (name) {
                parsedRows.push({
                    id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    code,
                    name,
                    type,
                    base_unit_code,
                    description,
                    remarks,
                    _status: 'new',
                    _errors: {}
                });
            }
        });

        if (parsedRows.length > 0) {
            setGridData(prev => [...prev, ...parsedRows]);
        }
        setPastedText('');
        setIsPasting(false);
    };

    // ─── Export CSV ────────────────────────────────────────────────────────────
    const handleExportCSV = () => {
        const headers = ['Code', 'Name', 'Type', 'Base Unit', 'Description', 'Remarks'];
        const csvRows = gridData.map(r => [
            r.code || '',
            r.name || '',
            r.type || '',
            r.base_unit_code || '',
            r.description || '',
            r.remarks || ''
        ]);

        const csvString = [
            headers.join(','),
            ...csvRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `mano_resources_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full select-none">
            {/* Custom dropdown backdrop */}
            {activeDropdownCell && (
                <div 
                    className="fixed inset-0 z-[4900] bg-transparent cursor-default" 
                    onClick={closeDropdown}
                />
            )}
            {/* Stats Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: 'Total Resources', value: stats.total, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-white/[0.03]' },
                        { label: 'Materials', value: stats.materials, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10' },
                        { label: 'Items', value: stats.items, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10' },
                        { label: 'Labour', value: stats.labour, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                    ].map((s, i) => (
                        <div key={i} className={`${s.bg} rounded-xl p-3 border border-gray-100 dark:border-white/5`}>
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                            <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-3 flex items-center justify-between border-b border-gray-200 dark:border-white/5 shrink-0 gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search name or code..."
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 shrink-0">
                        {[{ value: '', label: 'All' }, { value: 'material', label: 'Material' }, { value: 'item', label: 'Item' }, { value: 'labour', label: 'Labour' }].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setFilterType(opt.value)}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filterType === opt.value
                                    ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={fetchData}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>

                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:text-gray-800 border border-gray-250 dark:text-gray-400 dark:hover:text-white dark:border-white/10 bg-transparent rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition"
                        title="Export CSV"
                    >
                        <Download size={14} />
                        <span>Export CSV</span>
                    </button>

                    {canWrite && (
                        <>
                            <button
                                onClick={() => setIsPasting(true)}
                                className="flex items-center gap-1.5 px-3 py-2 text-blue-600 border border-blue-200 dark:text-blue-400 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/20 transition animate-pulse"
                                title="Paste spreadsheet data directly"
                            >
                                <Upload size={14} />
                                <span>Paste Excel</span>
                            </button>

                            <div className="relative group">
                                <button
                                    onClick={() => handleAddRows(1)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white rounded-lg text-xs font-semibold transition"
                                >
                                    <Plus size={14} />
                                    <span>Add Row</span>
                                </button>
                                <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 bg-white dark:bg-[#161b22] border border-gray-250 dark:border-white/10 rounded-lg shadow-xl py-1 text-xs w-28 font-semibold">
                                    <button onClick={() => handleAddRows(5)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300">Add 5 Rows</button>
                                    <button onClick={() => handleAddRows(10)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300">Add 10 Rows</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Unsaved Edits Alert Panel */}
            {pendingEditsCount > 0 && (
                <div className="px-6 py-2.5 bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-xs shrink-0">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <AlertCircle size={14} />
                        <span>You have <strong>{pendingEditsCount}</strong> pending changes. Save them to write to database.</span>
                        {saveError && <span className="text-red-500 font-semibold ml-2">Error: {saveError}</span>}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDiscardChanges}
                            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-white text-gray-600 dark:text-gray-300 rounded-lg text-[11px] font-bold transition shadow-sm bg-white dark:bg-transparent"
                        >
                            <RotateCcw size={12} />
                            Discard
                        </button>
                        <button
                            onClick={handleSaveChanges}
                            disabled={isSaving}
                            className="flex items-center gap-1 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold shadow-md shadow-emerald-500/10 transition"
                        >
                            <Save size={12} className={isSaving ? 'animate-spin' : ''} />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Layout with optional Sidebar detail panel */}
            <div className="flex-1 flex overflow-hidden w-full relative">
                {/* Spreadsheet Grid Table */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                        <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-wider text-[10px] uppercase font-bold select-none">
                            <tr>
                                <th className="px-3 py-3 w-10 text-center border-r border-gray-150 dark:border-white/5">#</th>
                                <th className="px-2 py-3 w-16 text-center border-r border-gray-150 dark:border-white/5">Status</th>
                                <th className="px-3 py-3 w-32 border-r border-gray-150 dark:border-white/5">Code</th>
                                <th className="px-3 py-3 w-64 border-r border-gray-150 dark:border-white/5">Name <span className="text-red-500">*</span></th>
                                <th className="px-3 py-3 w-36 border-r border-gray-150 dark:border-white/5">Type</th>
                                <th className="px-3 py-3 w-48 border-r border-gray-150 dark:border-white/5">Base Unit <span className="text-red-500">*</span></th>
                                <th className="px-3 py-3 border-r border-gray-150 dark:border-white/5">Description</th>
                                <th className="px-3 py-3 border-r border-gray-150 dark:border-white/5">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {isLoading && resources.length === 0 ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 9 }).map((_, j) => (
                                            <td key={j} className="px-3 py-3.5 border border-gray-100 dark:border-white/5">
                                                <div className="h-3 bg-gray-100 dark:bg-white/5 rounded"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : filteredGridData.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Package className="text-gray-300 dark:text-white/10" size={44} />
                                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No resources found</p>
                                            <p className="text-xs text-gray-400">
                                                {searchTerm || filterType ? 'Adjust your filters or query' : 'Create rows or paste from Excel to begin'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredGridData.map((resource, rowIndex) => {
                                    const isNew = resource._status === 'new';
                                    const isError = resource._status === 'error';
                                    const rowErrors = resource._errors || {};

                                    return (
                                        <tr
                                            key={resource.id}
                                            onClick={() => {
                                                if (!isNew && viewingResource !== resource.id) {
                                                    setViewingResource(resource.id);
                                                }
                                            }}
                                            onFocusCapture={() => {
                                                if (!isNew && viewingResource !== resource.id) {
                                                    setViewingResource(resource.id);
                                                }
                                            }}
                                            className={`hover:bg-blue-50/10 dark:hover:bg-white/[0.01] transition-colors group/row text-gray-700 dark:text-gray-300 cursor-pointer ${
                                                viewingResource === resource.id ? 'bg-blue-50/20 dark:bg-white/[0.02]' : ''
                                            }`}
                                        >
                                            {/* Row # */}
                                            <td className="px-3 py-3 text-center font-mono text-[10px] text-gray-400 border-r border-gray-100 dark:border-white/5 select-none bg-gray-50/50 dark:bg-white/[0.01]">
                                                {rowIndex + 1}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-2 py-3 text-center border-r border-gray-100 dark:border-white/5 select-none">
                                                {isNew && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/10 border-solid">
                                                        NEW
                                                    </span>
                                                )}
                                                {resource._status === 'modified' && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/10 border-solid">
                                                        DRAFT
                                                    </span>
                                                )}
                                                {isError && (
                                                    <span 
                                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-200/50 dark:border-red-500/10 border-solid cursor-help"
                                                        title={rowErrors.server || Object.values(rowErrors).join(', ') || 'Validation error'}
                                                    >
                                                        ERROR
                                                    </span>
                                                )}
                                                {resource._status === 'saved' && (
                                                    <span className="text-gray-300 dark:text-white/10 text-xs">—</span>
                                                )}
                                            </td>

                                            {/* Code */}
                                            <td
                                                id={`cell-${rowIndex}-code`}
                                                tabIndex={canWrite ? 0 : -1}
                                                onDoubleClick={() => {
                                                    if (canWrite) setEditingCell({ rowIndex, colName: 'code' });
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (canWrite) setEditingCell({ rowIndex, colName: 'code' });
                                                    } else {
                                                        handleKeyDown(e, rowIndex, 0);
                                                    }
                                                }}
                                                className={`p-0 border-r border-gray-100 dark:border-white/5 relative ${
                                                    rowErrors.code ? 'bg-red-500/5 ring-1 ring-red-500' : ''
                                                } focus:bg-blue-500/[0.03] dark:focus:bg-blue-500/[0.05] focus:outline-none`}
                                            >
                                                {editingCell?.rowIndex === rowIndex && editingCell?.colName === 'code' ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        className="w-full px-3 py-2.5 bg-white dark:bg-[#161b22] border border-blue-500 dark:border-blue-500/30 text-xs font-mono text-gray-850 dark:text-gray-200 focus:outline-none shadow-sm"
                                                        value={resource.code || ''}
                                                        onChange={e => handleCellChange(rowIndex, 'code', e.target.value)}
                                                        onBlur={() => setEditingCell(null)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    const nextRow = rowIndex + 1;
                                                                    document.getElementById(`cell-${nextRow}-code`)?.focus();
                                                                }, 10);
                                                            } else if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    document.getElementById(`cell-${rowIndex}-code`)?.focus();
                                                                }, 10);
                                                            } else if (e.key === 'Tab') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    const nextColIndex = e.shiftKey ? 5 : 1;
                                                                    const targetRow = e.shiftKey ? rowIndex - 1 : rowIndex;
                                                                    const columns = ['code', 'name', 'type', 'base_unit_code', 'description', 'remarks'];
                                                                    if (targetRow >= 0 && targetRow < filteredGridData.length) {
                                                                        document.getElementById(`cell-${targetRow}-${columns[nextColIndex]}`)?.focus();
                                                                    }
                                                                }, 10);
                                                            }
                                                        }}
                                                        placeholder="CEM-OPC"
                                                    />
                                                ) : (
                                                    <div className="w-full px-3 py-2.5 text-xs font-mono text-gray-800 dark:text-gray-200 truncate select-none min-h-[37px] flex items-center">
                                                        {resource.code || <span className="text-gray-350 dark:text-white/10 font-normal italic">CEM-OPC</span>}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Name */}
                                            <td
                                                id={`cell-${rowIndex}-name`}
                                                tabIndex={canWrite ? 0 : -1}
                                                onDoubleClick={() => {
                                                    if (canWrite) setEditingCell({ rowIndex, colName: 'name' });
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (canWrite) setEditingCell({ rowIndex, colName: 'name' });
                                                    } else {
                                                        handleKeyDown(e, rowIndex, 1);
                                                    }
                                                }}
                                                className={`p-0 border-r border-gray-100 dark:border-white/5 relative ${
                                                    rowErrors.name ? 'bg-red-500/5 ring-1 ring-red-500' : ''
                                                } focus:bg-blue-500/[0.03] dark:focus:bg-blue-500/[0.05] focus:outline-none`}
                                            >
                                                {editingCell?.rowIndex === rowIndex && editingCell?.colName === 'name' ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        className="w-full px-3 py-2.5 bg-white dark:bg-[#161b22] border border-blue-500 dark:border-blue-500/30 text-xs font-bold text-gray-900 dark:text-white focus:outline-none shadow-sm"
                                                        value={resource.name || ''}
                                                        onChange={e => handleCellChange(rowIndex, 'name', e.target.value)}
                                                        onBlur={() => setEditingCell(null)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    const nextRow = rowIndex + 1;
                                                                    document.getElementById(`cell-${nextRow}-name`)?.focus();
                                                                }, 10);
                                                            } else if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    document.getElementById(`cell-${rowIndex}-name`)?.focus();
                                                                }, 10);
                                                            } else if (e.key === 'Tab') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    const nextColIndex = e.shiftKey ? 0 : 2;
                                                                    const targetRow = rowIndex;
                                                                    const columns = ['code', 'name', 'type', 'base_unit_code', 'description', 'remarks'];
                                                                    document.getElementById(`cell-${targetRow}-${columns[nextColIndex]}`)?.focus();
                                                                }, 10);
                                                            }
                                                        }}
                                                        placeholder="Enter resource name..."
                                                    />
                                                ) : (
                                                    <div className="w-full px-3 py-2.5 text-xs font-bold text-gray-900 dark:text-white truncate select-none min-h-[37px] flex items-center">
                                                        {resource.name || <span className="text-gray-350 dark:text-white/10 font-normal italic">Enter resource name...</span>}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Type */}
                                            <td className="p-0 border-r border-gray-150 dark:border-white/5 relative">
                                                <div
                                                    id={`cell-${rowIndex}-type`}
                                                    tabIndex={0}
                                                    onClick={() => {
                                                        if (canWrite) {
                                                            setActiveDropdownCell({ rowIndex, colName: 'type' });
                                                        }
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            if (canWrite) {
                                                                setActiveDropdownCell({ rowIndex, colName: 'type' });
                                                            }
                                                        } else {
                                                            handleKeyDown(e, rowIndex, 2);
                                                        }
                                                    }}
                                                    className={`w-full h-full px-3 py-2.5 bg-transparent text-xs text-gray-900 dark:text-white focus:bg-blue-500/[0.03] dark:focus:bg-blue-500/[0.05] focus:outline-none cursor-pointer flex items-center justify-between group select-none ${
                                                        !canWrite ? 'opacity-60 cursor-not-allowed' : ''
                                                    }`}
                                                >
                                                    {(() => {
                                                        const tc = TYPE_CONFIG[resource.type || 'material'] || TYPE_CONFIG.material;
                                                        const TypeIcon = tc.icon;
                                                        return (
                                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${tc.bg} ${tc.color}`}>
                                                                <TypeIcon size={10} />
                                                                {tc.label}
                                                            </span>
                                                        );
                                                    })()}
                                                    {canWrite && (
                                                        <ChevronDown size={12} className="text-gray-400 group-hover:text-gray-650 dark:group-hover:text-gray-300 transition" />
                                                    )}
                                                </div>

                                                {/* Custom Type Popup */}
                                                {activeDropdownCell?.rowIndex === rowIndex && activeDropdownCell?.colName === 'type' && (
                                                    <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-[#161b22] border border-gray-250 dark:border-white/10 rounded-xl shadow-xl z-[4910] py-1 text-xs select-none">
                                                        {[
                                                            { value: 'material', label: 'Material', icon: Package, color: 'text-amber-600 dark:text-amber-400' },
                                                            { value: 'item', label: 'Item (Composite)', icon: Layers, color: 'text-purple-600 dark:text-purple-400' },
                                                            { value: 'labour', label: 'Labour', icon: Users, color: 'text-blue-600 dark:text-blue-400' }
                                                        ].map(opt => {
                                                            const Icon = opt.icon;
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    onClick={() => {
                                                                        handleCellChange(rowIndex, 'type', opt.value);
                                                                        closeDropdown();
                                                                    }}
                                                                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 flex items-center gap-2 font-semibold"
                                                                >
                                                                    <Icon size={13} className={opt.color} />
                                                                    <span>{opt.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Base Unit */}
                                            <td className={`p-0 border-r border-gray-155 dark:border-white/5 relative ${rowErrors.base_unit_code ? 'bg-red-500/5 ring-1 ring-red-500' : ''}`}>
                                                <div
                                                    id={`cell-${rowIndex}-base_unit_code`}
                                                    tabIndex={0}
                                                    onClick={() => {
                                                        if (canWrite) {
                                                            setActiveDropdownCell({ rowIndex, colName: 'base_unit_code' });
                                                        }
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            if (canWrite) {
                                                                setActiveDropdownCell({ rowIndex, colName: 'base_unit_code' });
                                                            }
                                                        } else {
                                                            handleKeyDown(e, rowIndex, 3);
                                                        }
                                                    }}
                                                    className={`w-full h-full px-3 py-2.5 bg-transparent text-xs text-gray-900 dark:text-white focus:bg-blue-500/[0.03] dark:focus:bg-blue-500/[0.05] focus:outline-none cursor-pointer flex items-center justify-between group select-none ${
                                                        !canWrite ? 'opacity-60 cursor-not-allowed' : ''
                                                    }`}
                                                >
                                                    {(() => {
                                                        const u = UNIT_REGISTRY[resource.base_unit_code];
                                                        return (
                                                            <span className="flex items-center gap-1.5">
                                                                <span className="font-semibold text-gray-955 dark:text-gray-100">
                                                                    {u ? u.name : 'Select unit'}
                                                                </span>
                                                                {u && (
                                                                    <span className="text-gray-400 dark:text-gray-550 font-medium text-[10px]">
                                                                        ({u.symbol})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        );
                                                    })()}
                                                    {canWrite && (
                                                        <ChevronDown size={12} className="text-gray-400 group-hover:text-gray-650 dark:group-hover:text-gray-300 transition" />
                                                    )}
                                                </div>

                                                {/* Custom Base Unit Autocomplete Popup */}
                                                {activeDropdownCell?.rowIndex === rowIndex && activeDropdownCell?.colName === 'base_unit_code' && (
                                                    <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#161b22] border border-gray-250 dark:border-white/10 rounded-xl shadow-xl z-[4910] flex flex-col max-h-80 overflow-hidden">
                                                        {/* Search bar */}
                                                        <div className="p-2 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] shrink-0">
                                                            <input
                                                                type="text"
                                                                placeholder="Search base units..."
                                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                                                value={unitSearch}
                                                                onChange={e => setUnitSearch(e.target.value)}
                                                                onClick={e => e.stopPropagation()} // Prevent close on click
                                                            />
                                                        </div>

                                                        {/* Scrollable list */}
                                                        <div className="overflow-y-auto flex-1 custom-scrollbar py-1">
                                                            {(() => {
                                                                const filteredGroups = Object.entries(UNIT_GROUPS).map(([type, units]) => {
                                                                    const matched = units.filter(u =>
                                                                        u.name.toLowerCase().includes(unitSearch.toLowerCase()) ||
                                                                        u.symbol.toLowerCase().includes(unitSearch.toLowerCase()) ||
                                                                        u.code.toLowerCase().includes(unitSearch.toLowerCase())
                                                                    );
                                                                    return [type, matched];
                                                                }).filter(([_, units]) => units.length > 0);

                                                                if (filteredGroups.length === 0) {
                                                                    return (
                                                                        <div className="p-3 text-center text-xs text-gray-400 italic">
                                                                            No units found
                                                                        </div>
                                                                    );
                                                                }

                                                                return filteredGroups.map(([type, units]) => (
                                                                    <div key={type} className="px-1 py-1">
                                                                        <div className="px-2 py-0.5 text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50/30 dark:bg-white/[0.01] rounded">
                                                                            {unitTypeLabel[type] || type}
                                                                        </div>
                                                                        {units.map(u => (
                                                                            <button
                                                                                key={u.code}
                                                                                onClick={() => {
                                                                                    handleCellChange(rowIndex, 'base_unit_code', u.code);
                                                                                    closeDropdown();
                                                                                }}
                                                                                className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold flex items-center justify-between"
                                                                            >
                                                                                <span>{u.name}</span>
                                                                                <span className="text-[10px] text-gray-405 dark:text-gray-550 font-mono">({u.symbol})</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Description */}
                                            <td
                                                id={`cell-${rowIndex}-description`}
                                                tabIndex={canWrite ? 0 : -1}
                                                onDoubleClick={() => {
                                                    if (canWrite) setEditingCell({ rowIndex, colName: 'description' });
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (canWrite) setEditingCell({ rowIndex, colName: 'description' });
                                                    } else {
                                                        handleKeyDown(e, rowIndex, 4);
                                                    }
                                                }}
                                                className="p-0 border-r border-gray-100 dark:border-white/5 relative focus:bg-blue-500/[0.03] dark:focus:bg-blue-500/[0.05] focus:outline-none"
                                            >
                                                {editingCell?.rowIndex === rowIndex && editingCell?.colName === 'description' ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        className="w-full px-3 py-2.5 bg-white dark:bg-[#161b22] border border-blue-500 dark:border-blue-500/30 text-xs text-gray-850 dark:text-gray-250 focus:outline-none shadow-sm"
                                                        value={resource.description || ''}
                                                        onChange={e => handleCellChange(rowIndex, 'description', e.target.value)}
                                                        onBlur={() => setEditingCell(null)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    const nextRow = rowIndex + 1;
                                                                    document.getElementById(`cell-${nextRow}-description`)?.focus();
                                                                }, 10);
                                                            } else if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    document.getElementById(`cell-${rowIndex}-description`)?.focus();
                                                                }, 10);
                                                            } else if (e.key === 'Tab') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    const nextColIndex = e.shiftKey ? 3 : 5;
                                                                    const targetRow = rowIndex;
                                                                    const columns = ['code', 'name', 'type', 'base_unit_code', 'description', 'remarks'];
                                                                    document.getElementById(`cell-${targetRow}-${columns[nextColIndex]}`)?.focus();
                                                                }, 10);
                                                            }
                                                        }}
                                                        placeholder="Short details..."
                                                    />
                                                ) : (
                                                    <div className="w-full px-3 py-2.5 text-xs text-gray-800 dark:text-gray-200 truncate select-none min-h-[37px] flex items-center">
                                                        {resource.description || <span className="text-gray-350 dark:text-white/10 font-normal italic">Short details...</span>}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Remarks */}
                                            <td
                                                id={`cell-${rowIndex}-remarks`}
                                                tabIndex={canWrite ? 0 : -1}
                                                onDoubleClick={() => {
                                                    if (canWrite) setEditingCell({ rowIndex, colName: 'remarks' });
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (canWrite) setEditingCell({ rowIndex, colName: 'remarks' });
                                                    } else {
                                                        handleKeyDown(e, rowIndex, 5);
                                                    }
                                                }}
                                                className="p-0 relative focus:bg-blue-500/[0.03] dark:focus:bg-blue-500/[0.05] focus:outline-none"
                                            >
                                                {editingCell?.rowIndex === rowIndex && editingCell?.colName === 'remarks' ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        className="w-full px-3 py-2.5 bg-white dark:bg-[#161b22] border border-blue-500 dark:border-blue-500/30 text-xs text-gray-850 dark:text-gray-255 focus:outline-none shadow-sm"
                                                        value={resource.remarks || ''}
                                                        onChange={e => handleCellChange(rowIndex, 'remarks', e.target.value)}
                                                        onBlur={() => setEditingCell(null)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    const nextRow = rowIndex + 1;
                                                                    document.getElementById(`cell-${nextRow}-remarks`)?.focus();
                                                                }, 10);
                                                            } else if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    document.getElementById(`cell-${rowIndex}-remarks`)?.focus();
                                                                }, 10);
                                                            } else if (e.key === 'Tab') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                                setTimeout(() => {
                                                                    const nextColIndex = e.shiftKey ? 4 : 0;
                                                                    const targetRow = e.shiftKey ? rowIndex : rowIndex + 1;
                                                                    const columns = ['code', 'name', 'type', 'base_unit_code', 'description', 'remarks'];
                                                                    if (targetRow < filteredGridData.length) {
                                                                        document.getElementById(`cell-${targetRow}-${columns[nextColIndex]}`)?.focus();
                                                                    }
                                                                }, 10);
                                                            }
                                                        }}
                                                        placeholder="Internal specs..."
                                                    />
                                                ) : (
                                                    <div className="w-full px-3 py-2.5 text-xs text-gray-800 dark:text-gray-200 truncate select-none min-h-[37px] flex items-center">
                                                        {resource.remarks || <span className="text-gray-350 dark:text-white/10 font-normal italic">Internal specs...</span>}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Sliding details drawer integration (covers full page height) */}
                <AnimatePresence>
                    {viewingResource && (
                        <>
                            {/* Backdrop overlay */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setViewingResource(null)}
                                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[4999] cursor-pointer"
                            />
                            {/* Full viewport height drawer */}
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                                className="fixed top-0 right-0 h-screen w-[480px] bg-white dark:bg-[#0d1117] flex flex-col shadow-2xl z-[5000] border-l border-gray-200 dark:border-white/10"
                            >
                                <ResourceDetail
                                    resourceId={viewingResource}
                                    onClose={() => setViewingResource(null)}
                                    onUpdate={fetchData}
                                    canWrite={canWrite}
                                    isDrawer={true}
                                    isModified={gridData.find(r => r.id === viewingResource)?._status === 'modified' || gridData.find(r => r.id === viewingResource)?._status === 'error'}
                                    onRevert={() => {
                                        const index = gridData.findIndex(r => r.id === viewingResource);
                                        const row = gridData.find(r => r.id === viewingResource);
                                        if (row && index !== -1) handleRevertRow(index, row);
                                    }}
                                    onDelete={() => {
                                        const row = gridData.find(r => r.id === viewingResource);
                                        if (row) handleDeleteRow(row);
                                    }}
                                />
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer */}
            {!isLoading && (
                <div className="px-6 py-2 border-t border-gray-100 dark:border-white/5 shrink-0 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
                    <p className="text-[11px] text-gray-400 font-semibold">
                        Showing <span className="font-semibold text-gray-600 dark:text-gray-300">{filteredGridData.length}</span> of <span className="font-semibold">{gridData.length}</span> rows
                    </p>
                    <p className="text-[10px] text-gray-400 select-none">
                        Double-click or press Enter to edit. Use Arrow keys to navigate.
                    </p>
                </div>
            )}

            {/* Paste Modal Overlay */}
            <AnimatePresence>
                {isPasting && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[5100] flex items-center justify-center p-4"
                    >
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPasting(false)} />
                        <motion.div
                            initial={{ scale: 0.95, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 15 }}
                            className="relative w-full max-w-xl bg-white dark:bg-[#161b22] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col"
                        >
                            <div className="px-6 py-4 border-b border-gray-150 dark:border-white/5 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Import Data from Excel</h3>
                                <button onClick={() => setIsPasting(false)} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Copy rows from Excel and paste (Ctrl+V) them in the box below.
                                    <br />
                                    Columns must be in the following order: <strong className="text-blue-500">Code | Name | Type | Base Unit | Description | Remarks</strong>.
                                </p>
                                <textarea
                                    className="w-full h-48 bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/50 focus:outline-none font-mono"
                                    placeholder="Paste grid here..."
                                    value={pastedText}
                                    onChange={e => setPastedText(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="px-6 py-4 border-t border-gray-150 dark:border-white/5 flex justify-end gap-3 bg-gray-55 dark:bg-transparent">
                                <button
                                    onClick={() => setIsPasting(false)}
                                    className="px-4 py-2 border border-gray-250 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePasteImport}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 transition"
                                >
                                    Import Rows
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ResourceList;
