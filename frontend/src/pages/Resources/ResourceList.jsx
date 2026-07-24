import React, { useState, useEffect, useRef } from 'react';
import {
    Search, Plus, Trash2, Info, RefreshCw, Package, Layers, Users, X, Upload,
    Download, Save, RotateCcw, AlertCircle, ChevronDown, Copy, Eye, CheckSquare,
    Square, ArrowUpDown, ArrowUp, ArrowDown, Filter, Sparkles, Check
} from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import ResourceDetail from './ResourceDetail';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { UNIT_REGISTRY, UNIT_OPTIONS, UNIT_GROUPS } from './resourceConstants';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';

const TYPE_CONFIG = {
    material: { label: 'Material', icon: Package, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    item: { label: 'Item', icon: Layers, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    labour: { label: 'Labour', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
};

const unitTypeLabel = { weight: 'Weight', volume: 'Volume', length: 'Length', area: 'Area', count: 'Count', time: 'Time' };

const GRID_COLUMNS = ['code', 'name', 'type', 'base_unit_code', 'description', 'remarks'];

const resolveType = (rawStr) => {
    if (!rawStr) return 'material';
    const cleaned = rawStr.trim().toLowerCase();
    if (['material', 'item', 'labour'].includes(cleaned)) return cleaned;
    if (cleaned === 'composite' || cleaned === 'items') return 'item';
    if (cleaned === 'materials') return 'material';
    if (cleaned === 'labor') return 'labour';
    return 'material';
};

const resolveUnitCode = (rawStr) => {
    if (!rawStr) return 'kg';
    const cleaned = rawStr.trim().toLowerCase();
    if (UNIT_REGISTRY[cleaned]) return cleaned;

    const found = Object.entries(UNIT_REGISTRY).find(([uCode, meta]) => {
        return (
            uCode.toLowerCase() === cleaned ||
            meta.symbol.toLowerCase() === cleaned ||
            meta.name.toLowerCase() === cleaned ||
            `(${meta.symbol.toLowerCase()})` === cleaned ||
            `${meta.name.toLowerCase()} (${meta.symbol.toLowerCase()})` === cleaned
        );
    });

    return found ? found[0] : 'kg';
};

const formatBackendError = (err) => {
    let rawMsg = err.response?.data?.message || err.message || 'Operation failed';

    if (rawMsg.includes('Cannot change type to "item"') || rawMsg.includes('component in other composite item recipes')) {
        return 'Cannot change type to "Item": This resource is used as a component in composite item recipes.';
    }
    if (rawMsg.includes('Duplicate entry') || rawMsg.includes('uk_resource_code_org')) {
        const match = rawMsg.match(/Duplicate entry '([^']+)'/);
        const codeVal = match ? match[1].split('-').slice(1).join('-') : '';
        return `Resource Code ${codeVal ? `"${codeVal}"` : ''} already exists. Please use a unique Code.`;
    }
    if (rawMsg.includes('Resource with ID') && rawMsg.includes('not found')) {
        return 'One of the updated resources was deleted from the database. Refreshing view.';
    }
    if (rawMsg.includes('Transaction rolled back due to error:')) {
        return rawMsg.replace(/^.*Transaction rolled back due to error:\s*/i, '');
    }

    return rawMsg;
};

const CustomCheckbox = ({ checked, onChange, title }) => (
    <div
        onClick={onChange}
        title={title}
        className={`w-4 h-4 rounded border transition-all flex items-center justify-center cursor-pointer select-none ${checked
            ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 shadow-sm shadow-blue-500/20'
            : 'border-gray-300 dark:border-white/20 bg-white dark:bg-[#161b22] hover:border-blue-400'
            }`}
    >
        {checked && <Check size={11} className="stroke-[3]" />}
    </div>
);

const ResourceList = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);

    // Ref to container for click outside detection
    const tableContainerRef = useRef(null);

    // Original list from server
    const [resources, setResources] = useState([]);
    const resourcesRef = useRef(resources);
    resourcesRef.current = resources;

    // Spreadsheet grid state
    const [gridData, setGridData] = useState([]);
    const gridDataRef = useRef(gridData);
    gridDataRef.current = gridData;

    // Undo / Redo Stacks
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);

    const pushUndoState = (gridSnapshot) => {
        undoStackRef.current.push(JSON.parse(JSON.stringify(gridSnapshot)));
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
    };

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [lastSelectedId, setLastSelectedId] = useState(null);

    // Sorting state
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    // Toast notification state
    const [toast, setToast] = useState(null);

    const showToast = (type, title, message, duration = 3000) => {
        setToast({ type, title, message, duration, id: Date.now() });
    };

    // Confirm Modal state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'danger',
        isLoading: false,
        onConfirm: () => { }
    });

    const closeConfirmModal = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
    };

    // Detail Panel Sidebar State
    const [viewingResource, setViewingResource] = useState(null);

    // Excel Range Cell Selection & Editing State
    const [selectionAnchor, setSelectionAnchor] = useState(null); // { r: number, c: number }
    const [selectionFocus, setSelectionFocus] = useState(null);   // { r: number, c: number }
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [editingCell, setEditingCell] = useState(null); // { rowIndex, colName }

    // Custom popups dropdown cell states
    const [activeDropdownCell, setActiveDropdownCell] = useState(null); // { rowIndex, colName }
    const [unitSearch, setUnitSearch] = useState('');

    // Bulk change popups
    const [showBulkTypeMenu, setShowBulkTypeMenu] = useState(false);
    const [showBulkUnitMenu, setShowBulkUnitMenu] = useState(false);
    const [bulkUnitSearch, setBulkUnitSearch] = useState('');

    const closeDropdown = () => {
        setActiveDropdownCell(null);
        setUnitSearch('');
        setShowBulkTypeMenu(false);
        setShowBulkUnitMenu(false);
        setBulkUnitSearch('');
    };

    // Robust Unique Code Generator across DB & Grid
    const generateUniqueCode = (baseCode, targetGrid = null) => {
        if (!baseCode) return '';
        const gridToUse = targetGrid || gridDataRef.current;

        const allCodes = new Set([
            ...resourcesRef.current.map(r => r.code).filter(Boolean).map(c => c.toLowerCase()),
            ...gridToUse.map(r => r.code).filter(Boolean).map(c => c.toLowerCase())
        ]);

        const cleanBase = baseCode.trim();
        const baseStem = cleanBase.replace(/(-copy(-\d+)?)$/i, '');
        let candidate = `${baseStem}-COPY`;
        let counter = 1;

        while (allCodes.has(candidate.toLowerCase())) {
            candidate = `${baseStem}-COPY-${counter}`;
            counter++;
        }

        allCodes.add(candidate.toLowerCase());
        return candidate;
    };

    // MouseUp global listener for range drag selection
    useEffect(() => {
        const handleGlobalMouseUp = () => setIsMouseDown(false);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // Global click outside & keydown listener to deselect cells
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (e.target.closest('.z-\\[6000\\]') || e.target.closest('.z-\\[9999\\]') || e.target.closest('.z-\\[7000\\]') || e.target.closest('[role="dialog"]')) {
                return;
            }
            if (!e.target.closest('td[id^="cell-"]')) {
                setSelectionAnchor(null);
                setSelectionFocus(null);
                setEditingCell(null);
                closeDropdown();
            }
        };

        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Escape') {
                setSelectionAnchor(null);
                setSelectionFocus(null);
                setEditingCell(null);
                setSelectedIds(new Set());
                closeDropdown();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, []);

    // Get current cell selection bounding box
    const getSelectionBounds = () => {
        if (!selectionAnchor) return null;
        const focus = selectionFocus || selectionAnchor;
        const minRow = Math.min(selectionAnchor.r, focus.r);
        const maxRow = Math.max(selectionAnchor.r, focus.r);
        const minCol = Math.min(selectionAnchor.c, focus.c);
        const maxCol = Math.max(selectionAnchor.c, focus.c);
        return { minRow, maxRow, minCol, maxCol };
    };

    // Stats
    const stats = {
        total: resources.length,
        materials: resources.filter(r => r.type === 'material').length,
        items: resources.filter(r => r.type === 'item').length,
        labour: resources.filter(r => r.type === 'labour').length,
    };

    const fetchData = async (isManualRefresh = false) => {
        setIsLoading(true);
        try {
            const resData = await resourceApi.getResources();
            const fetchedList = resData.resources || [];

            setResources(fetchedList);

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

            if (isManualRefresh) {
                showToast('info', 'Refreshed', 'Resource list updated from server.');
            }
        } catch (error) {
            console.error('Failed to fetch resources', error);
            const errMsg = formatBackendError(error);
            showToast('error', 'Fetch Error', errMsg, 5000);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ─── Debounced Auto-Save Trigger ──────────────────────────────────────────
    const saveTimeoutRef = useRef(null);

    const triggerAutoSave = (customGrid = null, delay = 1000) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveGridRows(customGrid);
        }, delay);
    };

    // ─── Real-Time Auto-Save Function (Optimized & Non-Blocking) ──────────────
    const saveGridRows = async (customGrid = null) => {
        const targetGrid = customGrid || gridDataRef.current;
        const newRows = targetGrid.filter(r => r._status === 'new' && r.name && r.name.trim() && r.base_unit_code);
        const modifiedRows = targetGrid.filter(r => r._status === 'modified' && r.name && r.name.trim() && r.base_unit_code);

        if (newRows.length === 0 && modifiedRows.length === 0) return;

        setIsSaving(true);
        try {
            const savedResourceIds = new Set(resourcesRef.current.map(r => r.id));
            const validModifiedRows = [];
            const newPayloadRows = [...newRows];

            modifiedRows.forEach(r => {
                if (savedResourceIds.has(r.id)) {
                    validModifiedRows.push(r);
                } else {
                    newPayloadRows.push(r);
                }
            });

            let createdResults = [];
            if (newPayloadRows.length > 0) {
                const cleanPayload = newPayloadRows.map(({ id, _status, _errors, ...rest }) => rest);
                const res = await resourceApi.bulkCreateResources(cleanPayload);
                createdResults = res?.resources || res?.data || (Array.isArray(res) ? res : []);
            }

            if (validModifiedRows.length > 0) {
                const cleanPayload = validModifiedRows.map(({ _status, _errors, base_unit_name, base_unit_symbol, ...rest }) => rest);
                await resourceApi.bulkUpdateResources(cleanPayload);
            }

            // In-memory instant update (avoids full network re-fetch of all database rows)
            setGridData(prevGrid => {
                const createdMap = new Map();
                if (createdResults.length > 0) {
                    newPayloadRows.forEach((nr, i) => {
                        if (createdResults[i]) createdMap.set(nr.id, createdResults[i]);
                    });
                }

                return prevGrid.map(row => {
                    if (validModifiedRows.some(m => m.id === row.id)) {
                        return { ...row, _status: 'saved', _errors: {} };
                    }
                    if (createdMap.has(row.id)) {
                        const realRes = createdMap.get(row.id);
                        return {
                            ...row,
                            id: realRes.id,
                            code: realRes.code || row.code,
                            _status: 'saved',
                            _errors: {}
                        };
                    }
                    return row;
                });
            });

            setResources(prev => {
                const updated = [...prev];
                validModifiedRows.forEach(mod => {
                    const idx = updated.findIndex(r => r.id === mod.id);
                    if (idx !== -1) updated[idx] = { ...updated[idx], ...mod, _status: 'saved' };
                });
                if (createdResults.length > 0) {
                    createdResults.forEach(c => {
                        if (!updated.some(r => r.id === c.id)) updated.push(c);
                    });
                }
                return updated;
            });

            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (err) {
            console.error('Failed to auto-save grid', err);
            const userFriendlyMsg = formatBackendError(err);
            showToast('error', 'Update Blocked by Backend', userFriendlyMsg, 5000);
        } finally {
            setIsSaving(false);
        }
    };

    // Sorting & Filtering local grid data
    const filteredGridData = gridData.filter(r => {
        const matchesType = filterType ? r.type === filterType : true;
        const matchesSearch = !searchTerm ||
            (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesType && matchesSearch;
    });

    const sortedGridData = [...filteredGridData].sort((a, b) => {
        if (!sortConfig.key) return 0;
        let aVal = a[sortConfig.key] || '';
        let bVal = b[sortConfig.key] || '';
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const sortedGridDataRef = useRef(sortedGridData);
    sortedGridDataRef.current = sortedGridData;

    // ─── Global Keyboard Shortcuts (Ctrl+Z Undo, Ctrl+Y Redo, Ctrl+A Select All) ───
    useEffect(() => {
        const handleGlobalShortcuts = (e) => {
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') {
                if (e.key === 'Escape') {
                    setEditingCell(null);
                    setSelectionAnchor(null);
                    setSelectionFocus(null);
                    setSelectedIds(new Set());
                    closeDropdown();
                }
                return;
            }

            if (e.key === 'Escape') {
                setEditingCell(null);
                setSelectionAnchor(null);
                setSelectionFocus(null);
                setSelectedIds(new Set());
                closeDropdown();
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifier = isMac ? e.metaKey : e.ctrlKey;

            // Ctrl+A / Cmd+A : Select All cells & rows
            if (modifier && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
                if (sortedGridDataRef.current.length > 0) {
                    setSelectionAnchor({ r: 0, c: 0 });
                    setSelectionFocus({
                        r: sortedGridDataRef.current.length - 1,
                        c: GRID_COLUMNS.length - 1
                    });
                    const allIds = new Set(sortedGridDataRef.current.map(r => r.id));
                    setSelectedIds(allIds);
                    showToast('info', 'Selected All', `Selected all ${sortedGridDataRef.current.length} row(s) and cells.`);
                }
                return;
            }

            // Ctrl+Z / Cmd+Z : Undo
            if (modifier && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                if (undoStackRef.current.length > 0) {
                    const previousState = undoStackRef.current.pop();
                    redoStackRef.current.push(JSON.parse(JSON.stringify(gridDataRef.current)));
                    setGridData(previousState);
                    triggerAutoSave(previousState, 500);
                    showToast('sparkle', 'Undo Successful', 'Restored previous spreadsheet state');
                } else {
                    showToast('info', 'Undo', 'No previous actions to undo');
                }
                return;
            }

            // Ctrl+Y / Cmd+Y or Ctrl+Shift+Z : Redo
            if (modifier && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
                e.preventDefault();
                if (redoStackRef.current.length > 0) {
                    const nextState = redoStackRef.current.pop();
                    undoStackRef.current.push(JSON.parse(JSON.stringify(gridDataRef.current)));
                    setGridData(nextState);
                    triggerAutoSave(nextState, 500);
                    showToast('sparkle', 'Redo Successful', 'Restored redone spreadsheet state');
                } else {
                    showToast('info', 'Redo', 'No actions to redo');
                }
                return;
            }
        };

        window.addEventListener('keydown', handleGlobalShortcuts);
        return () => window.removeEventListener('keydown', handleGlobalShortcuts);
    }, []);

    // ─── Cell Copy (Ctrl+C) & Cell Paste (Ctrl+V) Listeners ────────────────────
    useEffect(() => {
        const handleGlobalCopy = (e) => {
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;

            const bounds = getSelectionBounds();
            if (!bounds) return;

            e.preventDefault();
            const tsvLines = [];
            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                const rowObj = sortedGridDataRef.current[r];
                if (!rowObj) continue;
                const rowVals = [];
                for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                    const colName = GRID_COLUMNS[c];
                    let val = rowObj[colName] || '';
                    if (colName === 'base_unit_code') {
                        const u = UNIT_REGISTRY[val];
                        val = u ? u.name : val;
                    }
                    rowVals.push(val);
                }
                tsvLines.push(rowVals.join('\t'));
            }

            const tsvData = tsvLines.join('\n');
            if (tsvData) {
                navigator.clipboard.writeText(tsvData);
                const numCells = (bounds.maxRow - bounds.minRow + 1) * (bounds.maxCol - bounds.minCol + 1);
                showToast('sparkle', 'Copied to Clipboard', `Copied ${numCells} cell(s) across ${tsvLines.length} row(s)`);
            }
        };

        const handleGlobalPaste = (e) => {
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;

            const pastedData = e.clipboardData?.getData('text/plain');
            if (!pastedData || !pastedData.trim()) return;

            e.preventDefault();
            pushUndoState(gridDataRef.current);

            const bounds = getSelectionBounds();
            const startRow = bounds ? bounds.minRow : sortedGridDataRef.current.length;
            const startCol = bounds ? bounds.minCol : 0;

            const lines = pastedData.trim().split(/\r?\n/);
            let updatedGrid = [...gridDataRef.current];
            let numCellsUpdated = 0;
            let newRowsAddedCount = 0;
            let firstNewRowIndex = -1;

            lines.forEach((line, dr) => {
                if (!line.trim()) return;
                const r = startRow + dr;
                const cells = line.split('\t');

                const targetRowObj = sortedGridDataRef.current[r];
                if (targetRowObj) {
                    const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
                    if (realIdx !== -1) {
                        const rowCopy = { ...updatedGrid[realIdx] };
                        cells.forEach((cellVal, dc) => {
                            const c = startCol + dc;
                            if (c < GRID_COLUMNS.length) {
                                const colName = GRID_COLUMNS[c];
                                const trimmedVal = cellVal.trim();
                                if (colName === 'code') {
                                    if (trimmedVal) {
                                        const isDuplicate = resourcesRef.current.some(
                                            row => row.id !== targetRowObj.id && row.code?.toLowerCase() === trimmedVal.toLowerCase()
                                        ) || gridDataRef.current.some(
                                            row => row.id !== targetRowObj.id && row.code?.toLowerCase() === trimmedVal.toLowerCase()
                                        );
                                        rowCopy.code = isDuplicate ? generateUniqueCode(trimmedVal, updatedGrid) : trimmedVal;
                                    } else {
                                        rowCopy.code = '';
                                    }
                                } else if (colName === 'type') {
                                    rowCopy.type = resolveType(trimmedVal);
                                } else if (colName === 'base_unit_code') {
                                    rowCopy.base_unit_code = resolveUnitCode(trimmedVal);
                                } else {
                                    rowCopy[colName] = trimmedVal;
                                }
                                numCellsUpdated++;
                            }
                        });
                        if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                        updatedGrid[realIdx] = rowCopy;
                    }
                } else {
                    let code = cells[0]?.trim() || '';
                    let name = cells[1]?.trim() || (cells.length === 1 ? cells[0]?.trim() : '');
                    let type = cells[2] ? resolveType(cells[2]) : 'material';
                    let base_unit_code = cells[3] ? resolveUnitCode(cells[3]) : 'kg';
                    let description = cells[4]?.trim() || '';
                    let remarks = cells[5]?.trim() || '';

                    if (!name && code) {
                        name = code;
                    } else if (!name && !code) {
                        const nonVal = cells.find(c => c.trim());
                        if (nonVal) name = nonVal.trim();
                    }

                    if (name) {
                        if (!code) {
                            const stem = name.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'RES';
                            code = generateUniqueCode(stem, updatedGrid);
                        } else {
                            const isExisting = resourcesRef.current.some(r => r.code?.toLowerCase() === code.toLowerCase()) ||
                                updatedGrid.some(r => r.code?.toLowerCase() === code.toLowerCase());
                            if (isExisting) {
                                code = generateUniqueCode(code, updatedGrid);
                            }
                        }

                        const newRowIdx = updatedGrid.length;
                        if (firstNewRowIndex === -1) firstNewRowIndex = newRowIdx;

                        updatedGrid.push({
                            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${dr}`,
                            code,
                            name,
                            type,
                            base_unit_code,
                            description,
                            remarks,
                            _status: 'new',
                            _errors: {}
                        });
                        numCellsUpdated += cells.length;
                        newRowsAddedCount++;
                    }
                }
            });

            if (numCellsUpdated > 0) {
                setGridData(updatedGrid);
                if (newRowsAddedCount > 0) {
                    showToast('sparkle', 'Added New Rows', `Pasted ${newRowsAddedCount} new resource row(s) into spreadsheet`);
                } else {
                    showToast('sparkle', 'Excel Paste Success', `Pasted values into ${numCellsUpdated} cell(s) across spreadsheet`);
                }
                if (firstNewRowIndex !== -1) {
                    setSelectionAnchor({ r: firstNewRowIndex, c: 0 });
                    setSelectionFocus({ r: updatedGrid.length - 1, c: GRID_COLUMNS.length - 1 });
                }
                triggerAutoSave(updatedGrid, 500);
            }
        };

        window.addEventListener('copy', handleGlobalCopy);
        window.addEventListener('paste', handleGlobalPaste);
        return () => {
            window.removeEventListener('copy', handleGlobalCopy);
            window.removeEventListener('paste', handleGlobalPaste);
        };
    }, [selectionAnchor, selectionFocus]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // ─── Selection Management ──────────────────────────────────────────────────
    const handleSelectAll = (e) => {
        e?.stopPropagation();
        if (selectedIds.size === sortedGridData.length) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(sortedGridData.map(r => r.id));
            setSelectedIds(allIds);
        }
    };

    const handleToggleSelectRow = (e, id) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (e.shiftKey && lastSelectedId) {
                const currentIndex = sortedGridData.findIndex(r => r.id === id);
                const lastIndex = sortedGridData.findIndex(r => r.id === lastSelectedId);
                const [start, end] = [Math.min(currentIndex, lastIndex), Math.max(currentIndex, lastIndex)];
                for (let i = start; i <= end; i++) {
                    next.add(sortedGridData[i].id);
                }
            } else {
                if (next.has(id)) next.delete(id);
                else next.add(id);
            }
            return next;
        });
        setLastSelectedId(id);
    };

    // ─── Cell Management with Immediate Auto-Save & Undo Push ─────────────────
    const handleCellChange = (rowIndex, field, value, shouldAutoSave = false) => {
        pushUndoState(gridDataRef.current);
        let updatedGridData = [];
        setGridData(prev => {
            const updated = [...prev];
            const targetId = sortedGridDataRef.current[rowIndex]?.id;
            const realIdx = updated.findIndex(r => r.id === targetId);
            if (realIdx === -1) return prev;

            const row = { ...updated[realIdx] };
            row[field] = value;

            if (field === 'type' && value !== 'item') {
                row.compositions = [];
            }

            const errors = { ...(row._errors || {}) };
            if (field === 'name') {
                if (!value || !value.trim()) errors.name = 'Name is required';
                else delete errors.name;
            }
            if (field === 'base_unit_code') {
                if (!value) errors.base_unit_code = 'Base unit is required';
                else delete errors.base_unit_code;
            }

            row._errors = errors;
            if (Object.keys(errors).length === 0) {
                delete row._errors;
                if (row._status !== 'new') {
                    row._status = 'modified';
                }
            } else {
                row._status = 'error';
            }

            updated[realIdx] = row;
            updatedGridData = updated;
            return updated;
        });

        if (shouldAutoSave) {
            triggerAutoSave(updatedGridData.length ? updatedGridData : null, 400);
        } else {
            triggerAutoSave(updatedGridData.length ? updatedGridData : null, 1200);
        }
    };

    const handleCellBlur = () => {
        setEditingCell(null);
        triggerAutoSave(null, 600);
    };

    // ─── Helper for Deleting Entire Row Entries when All Cells Selected ────────
    const deleteSelectedRowEntries = async (rowsToDelete) => {
        pushUndoState(gridDataRef.current);
        const rowIds = new Set(rowsToDelete.map(r => r.id));
        const savedIds = rowsToDelete.filter(r => !String(r.id).startsWith('temp_')).map(r => r.id);

        // Instant Optimistic UI Update (1-2ms)
        setResources(prev => prev.filter(r => !rowIds.has(r.id)));
        setGridData(prev => prev.filter(r => !rowIds.has(r.id)));
        setSelectedIds(prev => {
            const next = new Set(prev);
            rowIds.forEach(id => next.delete(id));
            return next;
        });
        setSelectionAnchor(null);
        setSelectionFocus(null);
        showToast('success', 'Entry Deleted', `Deleted ${rowsToDelete.length} resource entry(ies).`);

        // Parallel background async delete (Non-blocking)
        if (savedIds.length > 0) {
            try {
                await Promise.all(savedIds.map(id => resourceApi.deleteResource(id)));
            } catch (err) {
                const msg = formatBackendError(err);
                showToast('error', 'Delete Failed', msg, 5000);
            }
        }
    };

    // ─── Spreadsheet Keyboard Navigation & Range Operations ────────────────────
    const handleCellKeyDown = (e, rowIndex, colName) => {
        const colIndex = GRID_COLUMNS.indexOf(colName);
        const totalRows = sortedGridData.length;
        const totalCols = GRID_COLUMNS.length;

        // If currently editing input inside the cell
        if (editingCell?.rowIndex === rowIndex && editingCell?.colName === colName) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCellBlur();
                if (rowIndex < totalRows - 1) {
                    setSelectionAnchor({ r: rowIndex + 1, c: colIndex });
                    setSelectionFocus({ r: rowIndex + 1, c: colIndex });
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditingCell(null);
                setSelectionAnchor(null);
                setSelectionFocus(null);
                setSelectedIds(new Set());
                closeDropdown();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                handleCellBlur();
                const nextColIdx = e.shiftKey ? colIndex - 1 : colIndex + 1;
                if (nextColIdx >= 0 && nextColIdx < totalCols) {
                    setSelectionAnchor({ r: rowIndex, c: nextColIdx });
                    setSelectionFocus({ r: rowIndex, c: nextColIdx });
                } else if (!e.shiftKey && rowIndex < totalRows - 1) {
                    setSelectionAnchor({ r: rowIndex + 1, c: 0 });
                    setSelectionFocus({ r: rowIndex + 1, c: 0 });
                }
            }
            return;
        }

        // Handle Delete / Backspace key
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const bounds = getSelectionBounds();
            if (bounds && canWrite) {
                e.preventDefault();

                // If ALL cells across the row(s) are selected, delete the entire entry properly!
                const isFullRowSelected = (bounds.minCol === 0 && bounds.maxCol === GRID_COLUMNS.length - 1);
                if (isFullRowSelected) {
                    const rowsToDelete = [];
                    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                        const targetRowObj = sortedGridDataRef.current[r];
                        if (targetRowObj) rowsToDelete.push(targetRowObj);
                    }
                    if (rowsToDelete.length > 0) {
                        deleteSelectedRowEntries(rowsToDelete);
                    }
                    return;
                }

                // Otherwise partial cell selection: clear text cell contents
                pushUndoState(gridDataRef.current);
                let updatedGrid = [...gridDataRef.current];
                let numCleared = 0;

                for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                    const targetRowObj = sortedGridDataRef.current[r];
                    if (!targetRowObj) continue;
                    const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
                    if (realIdx === -1) continue;

                    const rowCopy = { ...updatedGrid[realIdx] };
                    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                        const col = GRID_COLUMNS[c];
                        if (col !== 'type' && col !== 'base_unit_code' && col !== 'name') {
                            rowCopy[col] = '';
                            numCleared++;
                        }
                    }
                    if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                    updatedGrid[realIdx] = rowCopy;
                }

                if (numCleared > 0) {
                    setGridData(updatedGrid);
                    showToast('info', 'Cells Cleared', `Cleared content from ${numCleared} cell(s).`);
                    setTimeout(() => saveGridRows(updatedGrid), 150);
                }
            }
            return;
        }

        // Cell Selection Navigation with Arrow Keys & Shift Range Selection
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextRow = Math.min(totalRows - 1, (selectionFocus ? selectionFocus.r : rowIndex) + 1);
            if (e.shiftKey) {
                setSelectionFocus(prev => ({ r: nextRow, c: prev ? prev.c : colIndex }));
            } else {
                setSelectionAnchor({ r: nextRow, c: colIndex });
                setSelectionFocus({ r: nextRow, c: colIndex });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const nextRow = Math.max(0, (selectionFocus ? selectionFocus.r : rowIndex) - 1);
            if (e.shiftKey) {
                setSelectionFocus(prev => ({ r: nextRow, c: prev ? prev.c : colIndex }));
            } else {
                setSelectionAnchor({ r: nextRow, c: colIndex });
                setSelectionFocus({ r: nextRow, c: colIndex });
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const curCol = selectionFocus ? selectionFocus.c : colIndex;
            const nextCol = Math.min(totalCols - 1, curCol + 1);
            if (e.shiftKey) {
                setSelectionFocus(prev => ({ r: prev ? prev.r : rowIndex, c: nextCol }));
            } else {
                setSelectionAnchor({ r: rowIndex, c: nextCol });
                setSelectionFocus({ r: rowIndex, c: nextCol });
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const curCol = selectionFocus ? selectionFocus.c : colIndex;
            const nextCol = Math.max(0, curCol - 1);
            if (e.shiftKey) {
                setSelectionFocus(prev => ({ r: prev ? prev.r : rowIndex, c: nextCol }));
            } else {
                setSelectionAnchor({ r: rowIndex, c: nextCol });
                setSelectionFocus({ r: rowIndex, c: nextCol });
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (!e.shiftKey) {
                if (colIndex < totalCols - 1) {
                    setSelectionAnchor({ r: rowIndex, c: colIndex + 1 });
                    setSelectionFocus({ r: rowIndex, c: colIndex + 1 });
                } else if (rowIndex < totalRows - 1) {
                    setSelectionAnchor({ r: rowIndex + 1, c: 0 });
                    setSelectionFocus({ r: rowIndex + 1, c: 0 });
                }
            } else {
                if (colIndex > 0) {
                    setSelectionAnchor({ r: rowIndex, c: colIndex - 1 });
                    setSelectionFocus({ r: rowIndex, c: colIndex - 1 });
                } else if (rowIndex > 0) {
                    setSelectionAnchor({ r: rowIndex - 1, c: totalCols - 1 });
                    setSelectionFocus({ r: rowIndex - 1, c: totalCols - 1 });
                }
            }
        } else if (e.key === 'Enter' || e.key === 'F2') {
            e.preventDefault();
            if (canWrite) {
                if (colName === 'type' || colName === 'base_unit_code') {
                    setActiveDropdownCell({ rowIndex, colName });
                } else {
                    setEditingCell({ rowIndex, colName });
                }
            }
        } else if (canWrite && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (colName !== 'type' && colName !== 'base_unit_code') {
                setEditingCell({ rowIndex, colName });
                handleCellChange(rowIndex, colName, e.key);
            }
        }
    };

    // ─── Add Row(s) ────────────────────────────────────────────────────────────
    const handleAddRows = (count = 1) => {
        pushUndoState(gridDataRef.current);
        const newRows = Array.from({ length: count }).map((_, idx) => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${idx}`,
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
        showToast('info', 'Rows Added', `Added ${count} new resource row(s).`);
    };

    // ─── Duplicate Row ──────────────────────────────────────────────────────────
    const handleDuplicateRow = (row) => {
        pushUndoState(gridDataRef.current);
        const duplicate = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${Math.floor(Math.random() * 1000)}`,
            code: row.code ? generateUniqueCode(row.code) : '',
            name: row.name ? `${row.name} (Copy)` : 'New Copy',
            type: row.type || 'material',
            base_unit_code: row.base_unit_code || 'kg',
            description: row.description || '',
            remarks: row.remarks || '',
            _status: 'new',
            _errors: {}
        };
        let updatedGrid = [];
        setGridData(prev => {
            updatedGrid = [...prev, duplicate];
            return updatedGrid;
        });
        showToast('sparkle', 'Row Duplicated', `Duplicated "${row.name || 'resource'}".`);
        setTimeout(() => saveGridRows(updatedGrid), 150);
    };

    // ─── Bulk Actions ───────────────────────────────────────────────────────────
    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;

        setConfirmModal({
            isOpen: true,
            title: 'Delete Selected Resources?',
            message: `Are you sure you want to delete ${selectedIds.size} selected resource(s)? This action cannot be undone.`,
            confirmText: `Delete (${selectedIds.size})`,
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                pushUndoState(gridDataRef.current);
                const idsToDelete = Array.from(selectedIds);
                const savedIds = idsToDelete.filter(id => !String(id).startsWith('temp_'));
                const count = selectedIds.size;

                // Instant Optimistic UI Update (1-2ms)
                setResources(prev => prev.filter(r => !selectedIds.has(r.id)));
                setGridData(prev => prev.filter(r => !selectedIds.has(r.id)));
                setSelectedIds(new Set());
                if (viewingResource && selectedIds.has(viewingResource)) {
                    setViewingResource(null);
                }
                closeConfirmModal();
                showToast('success', 'Bulk Delete Successful', `Deleted ${count} selected resource(s).`);

                // Parallel background async delete (Non-blocking)
                if (savedIds.length > 0) {
                    try {
                        await Promise.all(savedIds.map(id => resourceApi.deleteResource(id)));
                    } catch (err) {
                        const msg = formatBackendError(err);
                        showToast('error', 'Delete Failed', msg, 5000);
                    }
                }
            }
        });
    };

    const handleBulkDuplicate = () => {
        if (selectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);
        const selectedRows = gridData.filter(r => selectedIds.has(r.id));
        const duplicates = selectedRows.map((row, idx) => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${idx}`,
            code: row.code ? generateUniqueCode(row.code) : '',
            name: row.name ? `${row.name} (Copy)` : 'Copy',
            type: row.type || 'material',
            base_unit_code: row.base_unit_code || 'kg',
            description: row.description || '',
            remarks: row.remarks || '',
            _status: 'new',
            _errors: {}
        }));
        let nextGrid = [];
        setGridData(prev => {
            nextGrid = [...prev, ...duplicates];
            return nextGrid;
        });
        const count = selectedIds.size;
        setSelectedIds(new Set());
        showToast('sparkle', 'Bulk Duplicated', `Created ${count} row duplicate(s).`);
        triggerAutoSave(nextGrid, 400);
    };

    const handleBulkChangeType = (newType) => {
        if (selectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);
        const count = selectedIds.size;
        let updatedGrid = [];
        setGridData(prev => {
            updatedGrid = prev.map(row => {
                if (selectedIds.has(row.id)) {
                    return {
                        ...row,
                        type: newType,
                        compositions: newType !== 'item' ? [] : row.compositions,
                        _status: row._status === 'new' ? 'new' : 'modified'
                    };
                }
                return row;
            });
            return updatedGrid;
        });
        closeDropdown();
        showToast('sparkle', 'Type Updated', `Changed type to "${newType.toUpperCase()}" for ${count} row(s).`);
        triggerAutoSave(updatedGrid, 400);
    };

    const handleBulkChangeUnit = (newUnit) => {
        if (selectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);
        const count = selectedIds.size;
        const u = UNIT_REGISTRY[newUnit];
        const unitName = u ? u.name : newUnit;

        let updatedGrid = [];
        setGridData(prev => {
            updatedGrid = prev.map(row => {
                if (selectedIds.has(row.id)) {
                    return {
                        ...row,
                        base_unit_code: newUnit,
                        _status: row._status === 'new' ? 'new' : 'modified'
                    };
                }
                return row;
            });
            return updatedGrid;
        });
        closeDropdown();
        showToast('sparkle', 'Unit Updated', `Changed base unit to "${unitName}" for ${count} row(s).`);
        triggerAutoSave(updatedGrid, 400);
    };

    // ─── Delete Row ─────────────────────────────────────────────────────────────
    const handleDeleteRow = (row) => {
        if (row._status === 'new') {
            pushUndoState(gridDataRef.current);
            setGridData(prev => prev.filter(r => r.id !== row.id));
            showToast('info', 'Row Removed', 'Removed newly added row.');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Delete Resource?',
            message: `Are you sure you want to delete "${row.name || 'this resource'}"? This action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                pushUndoState(gridDataRef.current);

                // Instant Optimistic UI Update (1-2ms)
                setResources(prev => prev.filter(r => r.id !== row.id));
                setGridData(prev => prev.filter(r => r.id !== row.id));
                if (viewingResource === row.id) {
                    setViewingResource(null);
                }
                closeConfirmModal();
                showToast('success', 'Resource Deleted', `Deleted "${row.name || 'Resource'}".`);

                // Async background delete
                try {
                    await resourceApi.deleteResource(row.id);
                } catch (err) {
                    const msg = formatBackendError(err);
                    showToast('error', 'Delete Failed', msg, 5000);
                }
            }
        });
    };

    // ─── Export CSV ────────────────────────────────────────────────────────────
    const handleExportCSV = () => {
        const headers = ['Code', 'Name', 'Type', 'Base Unit', 'Description', 'Remarks'];
        const csvRows = sortedGridData.map(r => [
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

        showToast('success', 'Export Complete', `Exported ${sortedGridData.length} resources to CSV.`);
    };

    const bounds = getSelectionBounds();

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full relative">


            {/* Custom Confirmation Dialog */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={closeConfirmModal}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                variant={confirmModal.variant}
                isLoading={confirmModal.isLoading}
            />

            {/* Custom Footer Center Toast Notification */}
            <Toast toast={toast} onClose={() => setToast(null)} />

            {/* Stats Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { id: 'total', label: 'Total Resources', value: stats.total, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-white/[0.03]' },
                        { id: 'materials', label: 'Materials', value: stats.materials, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10' },
                        { id: 'items', label: 'Items', value: stats.items, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10' },
                        { id: 'labour', label: 'Labour', value: stats.labour, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                    ].map((s) => (
                        <div key={s.id} className={`${s.bg} rounded-xl p-3 border border-gray-100 dark:border-white/5`}>
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                            <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Toolbar - Search Bar & Sync Status */}
            <div className="px-6 py-3 flex items-center justify-between border-b border-gray-200 dark:border-white/5 shrink-0 gap-3">
                <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-400 font-semibold">
                        Spreadsheet View
                    </div>

                    {/* Real-time Auto-Save Status Indicator */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 text-[11px] font-medium">
                        {isSaving ? (
                            <>
                                <RefreshCw size={11} className="animate-spin text-blue-500" />
                                <span className="text-blue-600 dark:text-blue-400 font-semibold">Auto-saving...</span>
                            </>
                        ) : (
                            <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-gray-600 dark:text-gray-300 font-semibold">Real-time sync</span>
                                {lastSavedTime && (
                                    <span className="text-gray-400 text-[10px] ml-1">({lastSavedTime})</span>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {/* Search Bar */}
                    <div className="relative w-48">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search name or code..."
                            className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 shrink-0">
                        {[{ value: '', label: 'All' }, { value: 'material', label: 'Material' }, { value: 'item', label: 'Item' }, { value: 'labour', label: 'Labour' }].map(opt => (
                            <button
                                key={opt.value || 'all'}
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

                    {/* Export CSV button */}
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:text-gray-800 border border-gray-250 dark:text-gray-400 dark:hover:text-white dark:border-white/10 bg-transparent rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition"
                        title="Export CSV"
                    >
                        <Download size={14} />
                        <span>Export CSV</span>
                    </button>

                    {/* Refresh button */}
                    <button
                        onClick={() => fetchData(true)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>

                    {/* Add Row button */}
                    {canWrite && (
                        <div className="relative group">
                            <button
                                onClick={() => handleAddRows(1)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-blue-500/20"
                            >
                                <Plus size={14} />
                                <span>Add Row</span>
                            </button>
                            <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 bg-white dark:bg-[#161b22] border border-gray-250 dark:border-white/10 rounded-md shadow-xl py-1 text-xs w-28 font-semibold">
                                <button onClick={() => handleAddRows(5)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300">Add 5 Rows</button>
                                <button onClick={() => handleAddRows(10)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300">Add 10 Rows</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Excel Floating Bulk Actions Toolbar */}
            {selectedIds.size > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-6 py-2.5 bg-blue-600 text-white flex items-center justify-between text-xs shrink-0 shadow-lg z-30"
                >
                    <div className="flex items-center gap-3 font-semibold">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-md font-bold text-[11px]">
                            <CheckSquare size={14} />
                            {selectedIds.size} row(s) selected
                        </span>
                        <span className="text-white/70">· Bulk Operations:</span>
                    </div>

                    <div className="flex items-center gap-2 relative">
                        {canWrite && (
                            <>
                                <button
                                    onClick={handleBulkDuplicate}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition"
                                    title="Duplicate selected rows"
                                >
                                    <Copy size={13} />
                                    Duplicate ({selectedIds.size})
                                </button>

                                {/* Bulk Change Type Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            setShowBulkTypeMenu(v => !v);
                                            setShowBulkUnitMenu(false);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition"
                                    >
                                        <span>Change Type</span>
                                        <ChevronDown size={12} />
                                    </button>
                                    {showBulkTypeMenu && (
                                        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-xl z-[6000] py-1 text-xs text-gray-800 dark:text-gray-200 font-medium no-scrollbar">
                                            {['material', 'item', 'labour'].map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => handleBulkChangeType(t)}
                                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/5 capitalize font-semibold"
                                                >
                                                    Set to {t}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Bulk Change Base Unit Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            setShowBulkUnitMenu(v => !v);
                                            setShowBulkTypeMenu(false);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition"
                                    >
                                        <span>Change Base Unit</span>
                                        <ChevronDown size={12} />
                                    </button>
                                    {showBulkUnitMenu && (
                                        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-xl z-[6000] p-2 text-xs text-gray-800 dark:text-gray-200 flex flex-col max-h-64 overflow-hidden">
                                            <input
                                                type="text"
                                                placeholder="Search base unit..."
                                                className="w-full px-2 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs focus:outline-none mb-1 font-semibold text-gray-900 dark:text-white"
                                                value={bulkUnitSearch}
                                                onChange={e => setBulkUnitSearch(e.target.value)}
                                            />
                                            <div className="overflow-y-auto no-scrollbar flex-1">
                                                {UNIT_OPTIONS
                                                    .filter(u => u.name.toLowerCase().includes(bulkUnitSearch.toLowerCase()) || u.symbol.toLowerCase().includes(bulkUnitSearch.toLowerCase()) || u.code.toLowerCase().includes(bulkUnitSearch.toLowerCase()))
                                                    .map(u => (
                                                        <button
                                                            key={u.code}
                                                            onClick={() => handleBulkChangeUnit(u.code)}
                                                            className="w-full text-left px-2.5 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-xs font-semibold flex justify-between items-center"
                                                        >
                                                            <span>{u.name}</span>
                                                            <span className="text-[10px] text-gray-400">({u.symbol})</span>
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                >
                                    <Trash2 size={13} />
                                    Delete ({selectedIds.size})
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="px-2.5 py-1.5 text-white/80 hover:text-white text-xs font-medium"
                        >
                            Deselect
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Main Content Layout with optional Sidebar detail panel */}
            <div ref={tableContainerRef} className="flex-1 min-h-0 flex overflow-hidden w-full relative">
                {/* Spreadsheet Grid Table */}
                <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                    <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                        <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-20 border-b border-gray-200 dark:border-white/5 tracking-wider text-[10px] uppercase font-bold select-none shadow-sm">
                            <tr>
                                {/* Master Checkbox */}
                                <th className="px-3 py-3 w-10 text-center border-r border-gray-150 dark:border-white/5">
                                    <div className="flex justify-center">
                                        <CustomCheckbox
                                            checked={sortedGridData.length > 0 && selectedIds.size === sortedGridData.length}
                                            onChange={handleSelectAll}
                                            title="Select All"
                                        />
                                    </div>
                                </th>
                                <th className="px-3 py-3 w-10 text-center border-r border-gray-150 dark:border-white/5">#</th>
                                <th className="px-2 py-3 w-16 text-center border-r border-gray-150 dark:border-white/5">Status</th>

                                {/* Sortable Column Headers */}
                                <th
                                    onClick={() => handleSort('code')}
                                    className="px-3 py-3 w-32 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <span>Code</span>
                                        {sortConfig.key === 'code' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('name')}
                                    className="px-3 py-3 w-64 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <span>Name <span className="text-red-500">*</span></span>
                                        {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('type')}
                                    className="px-3 py-3 w-36 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <span>Type</span>
                                        {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSort('base_unit_code')}
                                    className="px-3 py-3 w-48 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <span>Base Unit <span className="text-red-500">*</span></span>
                                        {sortConfig.key === 'base_unit_code' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </div>
                                </th>
                                <th className="px-3 py-3 border-r border-gray-150 dark:border-white/5">Description</th>
                                <th className="px-3 py-3 border-r border-gray-150 dark:border-white/5">Remarks</th>
                                <th className="px-3 py-3 w-28 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {isLoading && resources.length === 0 ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`skel-row-${i}`} className="animate-pulse">
                                        {Array.from({ length: 10 }).map((_, j) => (
                                            <td key={`skel-cell-${i}-${j}`} className="px-3 py-3.5 border border-gray-100 dark:border-white/5">
                                                <div className="h-3 bg-gray-100 dark:bg-white/5 rounded"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : sortedGridData.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Package className="text-gray-300 dark:text-white/10" size={44} />
                                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No resources found</p>
                                            <p className="text-xs text-gray-400">
                                                {searchTerm || filterType ? 'Adjust your filters' : 'Copy rows from Excel and press Ctrl+V to paste instantly'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sortedGridData.map((resource, rowIndex) => {
                                    const isNew = resource._status === 'new';
                                    const isError = resource._status === 'error';
                                    const rowErrors = resource._errors || {};
                                    const isRowSelected = selectedIds.has(resource.id);

                                    return (
                                        <tr
                                            key={resource.id || `row-${rowIndex}`}
                                            className={`hover:bg-blue-50/20 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 ${isRowSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                                                }`}
                                        >
                                            {/* Checkbox Cell */}
                                            <td className="px-3 py-3 text-center border-r border-gray-100 dark:border-white/5 select-none">
                                                <div className="flex justify-center">
                                                    <CustomCheckbox
                                                        checked={isRowSelected}
                                                        onChange={(e) => handleToggleSelectRow(e, resource.id)}
                                                        title="Select Row"
                                                    />
                                                </div>
                                            </td>

                                            {/* Row # */}
                                            <td className="px-3 py-3 text-center font-mono text-[10px] text-gray-400 border-r border-gray-100 dark:border-white/5 select-none bg-gray-50/50 dark:bg-white/[0.01]">
                                                {rowIndex + 1}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-2 py-3 text-center border-r border-gray-100 dark:border-white/5 select-none">
                                                {isNew && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/10">
                                                        NEW
                                                    </span>
                                                )}
                                                {isError && (
                                                    <span
                                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-200/50 dark:border-red-500/10 cursor-help"
                                                        title={rowErrors.server || Object.values(rowErrors).join(', ') || 'Validation error'}
                                                    >
                                                        ERROR
                                                    </span>
                                                )}
                                                {resource._status === 'saved' && (
                                                    <span className="text-emerald-500 dark:text-emerald-400/80 text-[10px] font-bold">SAVED</span>
                                                )}
                                            </td>

                                            {/* ─── GRID CELLS (Code, Name, Type, Base Unit, Description, Remarks) ─── */}
                                            {GRID_COLUMNS.map((colName, colIndex) => {
                                                const isInRange = bounds && (
                                                    rowIndex >= bounds.minRow && rowIndex <= bounds.maxRow &&
                                                    colIndex >= bounds.minCol && colIndex <= bounds.maxCol
                                                );
                                                const isTopEdge = bounds && rowIndex === bounds.minRow && colIndex >= bounds.minCol && colIndex <= bounds.maxCol;
                                                const isBottomEdge = bounds && rowIndex === bounds.maxRow && colIndex >= bounds.minCol && colIndex <= bounds.maxCol;
                                                const isLeftEdge = bounds && colIndex === bounds.minCol && rowIndex >= bounds.minRow && rowIndex <= bounds.maxRow;
                                                const isRightEdge = bounds && colIndex === bounds.maxCol && rowIndex >= bounds.minRow && rowIndex <= bounds.maxRow;
                                                const isFillHandleCell = bounds && rowIndex === bounds.maxRow && colIndex === bounds.maxCol;

                                                const isEdit = editingCell?.rowIndex === rowIndex && editingCell?.colName === colName;
                                                const hasError = rowErrors[colName];

                                                return (
                                                    <td
                                                        key={colName}
                                                        id={`cell-${rowIndex}-${colName}`}
                                                        tabIndex={0}
                                                        onMouseDown={(e) => {
                                                            if (e.shiftKey && selectionAnchor) {
                                                                setSelectionFocus({ r: rowIndex, c: colIndex });
                                                            } else {
                                                                setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                setIsMouseDown(true);
                                                            }
                                                        }}
                                                        onMouseEnter={() => {
                                                            if (isMouseDown) {
                                                                setSelectionFocus({ r: rowIndex, c: colIndex });
                                                            }
                                                        }}
                                                        onDoubleClick={() => {
                                                            if (canWrite) {
                                                                setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                if (colName === 'type' || colName === 'base_unit_code') {
                                                                    setActiveDropdownCell({ rowIndex, colName });
                                                                } else {
                                                                    setEditingCell({ rowIndex, colName });
                                                                }
                                                            }
                                                        }}
                                                        onKeyDown={e => handleCellKeyDown(e, rowIndex, colName)}
                                                        className={`p-0 border-r border-gray-100 dark:border-white/5 relative outline-none transition-colors ${isInRange ? 'bg-blue-500/15 dark:bg-blue-500/25 z-10' : ''
                                                            } ${isTopEdge ? 'border-t-2 border-t-blue-500' : ''} ${isBottomEdge ? 'border-b-2 border-b-blue-500' : ''
                                                            } ${isLeftEdge ? 'border-l-2 border-l-blue-500' : ''} ${isRightEdge ? 'border-r-2 border-r-blue-500' : ''
                                                            } ${hasError ? 'bg-red-500/5 ring-1 ring-red-500' : ''}`}
                                                    >
                                                        {isFillHandleCell && !isEdit && (
                                                            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-600 border border-white dark:border-gray-900 rounded-sm z-30 pointer-events-none shadow-sm" />
                                                        )}

                                                        {/* Text Cells Editing vs Normal State */}
                                                        {colName !== 'type' && colName !== 'base_unit_code' && (
                                                            isEdit ? (
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    className={`w-full px-3 py-2.5 bg-white dark:bg-[#161b22] border border-blue-500 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none shadow-sm ${colName === 'code' ? 'font-mono' : ''
                                                                        }`}
                                                                    value={resource[colName] || ''}
                                                                    onChange={e => handleCellChange(rowIndex, colName, e.target.value)}
                                                                    onBlur={handleCellBlur}
                                                                    onKeyDown={e => handleCellKeyDown(e, rowIndex, colName)}
                                                                    placeholder={
                                                                        colName === 'code' ? 'CEM-OPC' :
                                                                            colName === 'name' ? 'Enter resource name...' :
                                                                                colName === 'description' ? 'Short details...' : 'Internal specs...'
                                                                    }
                                                                />
                                                            ) : (
                                                                <div className={`w-full px-3 py-2.5 text-xs text-gray-800 dark:text-gray-200 truncate cursor-pointer min-h-[37px] flex items-center ${colName === 'code' ? 'font-mono' : colName === 'name' ? 'font-bold text-gray-900 dark:text-white' : ''
                                                                    }`}>
                                                                    {resource[colName] || <span className="text-gray-350 dark:text-white/10 font-normal italic">
                                                                        {colName === 'code' ? 'CEM-OPC' : colName === 'name' ? 'Enter resource name...' : colName === 'description' ? 'Short details...' : 'Internal specs...'}
                                                                    </span>}
                                                                </div>
                                                            )
                                                        )}

                                                        {/* Type Dropdown Cell */}
                                                        {colName === 'type' && (
                                                            <>
                                                                <div
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                        setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                        if (canWrite) {
                                                                            setActiveDropdownCell(prev =>
                                                                                prev?.rowIndex === rowIndex && prev?.colName === 'type' ? null : { rowIndex, colName: 'type' }
                                                                            );
                                                                        }
                                                                    }}
                                                                    className={`w-full h-full px-3 py-2.5 bg-transparent text-xs text-gray-900 dark:text-white cursor-pointer flex items-center justify-between group select-none ${!canWrite ? 'opacity-60 cursor-not-allowed' : ''
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
                                                                        <ChevronDown size={12} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition" />
                                                                    )}
                                                                </div>

                                                                {activeDropdownCell?.rowIndex === rowIndex && activeDropdownCell?.colName === 'type' && (
                                                                    <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-2xl z-[6000] py-1 text-xs select-none no-scrollbar">
                                                                        {[
                                                                            { value: 'material', label: 'Material', icon: Package, color: 'text-amber-600 dark:text-amber-400' },
                                                                            { value: 'item', label: 'Item (Composite)', icon: Layers, color: 'text-purple-600 dark:text-purple-400' },
                                                                            { value: 'labour', label: 'Labour', icon: Users, color: 'text-blue-600 dark:text-blue-400' }
                                                                        ].map(opt => {
                                                                            const Icon = opt.icon;
                                                                            return (
                                                                                <button
                                                                                    key={opt.value}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleCellChange(rowIndex, 'type', opt.value, true);
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
                                                            </>
                                                        )}

                                                        {/* Base Unit Dropdown Cell */}
                                                        {colName === 'base_unit_code' && (
                                                            <>
                                                                <div
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                        setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                        if (canWrite) {
                                                                            setActiveDropdownCell(prev =>
                                                                                prev?.rowIndex === rowIndex && prev?.colName === 'base_unit_code' ? null : { rowIndex, colName: 'base_unit_code' }
                                                                            );
                                                                        }
                                                                    }}
                                                                    className={`w-full h-full px-3 py-2.5 bg-transparent text-xs text-gray-900 dark:text-white cursor-pointer flex items-center justify-between group select-none ${!canWrite ? 'opacity-60 cursor-not-allowed' : ''
                                                                        }`}
                                                                >
                                                                    {(() => {
                                                                        const u = UNIT_REGISTRY[resource.base_unit_code];
                                                                        return (
                                                                            <span className="flex items-center gap-1.5">
                                                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                                                    {u ? u.name : 'Select unit'}
                                                                                </span>
                                                                                {u && (
                                                                                    <span className="text-gray-400 dark:text-gray-500 font-medium text-[10px]">
                                                                                        ({u.symbol})
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                    {canWrite && (
                                                                        <ChevronDown size={12} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition" />
                                                                    )}
                                                                </div>

                                                                {activeDropdownCell?.rowIndex === rowIndex && activeDropdownCell?.colName === 'base_unit_code' && (
                                                                    <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-2xl z-[6000] flex flex-col max-h-72 overflow-hidden">
                                                                        <div className="p-2 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] shrink-0">
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Search base units..."
                                                                                className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-md text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                                                                value={unitSearch}
                                                                                onChange={e => setUnitSearch(e.target.value)}
                                                                                onClick={e => e.stopPropagation()}
                                                                            />
                                                                        </div>

                                                                        <div className="overflow-y-auto no-scrollbar flex-1 py-1">
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
                                                                                        <div className="px-2 py-0.5 text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50/50 dark:bg-white/[0.01] rounded">
                                                                                            {unitTypeLabel[type] || type}
                                                                                        </div>
                                                                                        {units.map(u => (
                                                                                            <button
                                                                                                key={u.code}
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleCellChange(rowIndex, 'base_unit_code', u.code, true);
                                                                                                    closeDropdown();
                                                                                                }}
                                                                                                className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold flex items-center justify-between"
                                                                                            >
                                                                                                <span>{u.name}</span>
                                                                                                <span className="text-[10px] text-gray-400 font-mono">({u.symbol})</span>
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                ));
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* Dedicated Row Actions Cell */}
                                            <td className="px-2 py-2 text-center select-none">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setViewingResource(resource.id);
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                                                        title="View / Manage Resource Details"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    {canWrite && (
                                                        <>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDuplicateRow(resource);
                                                                }}
                                                                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                                                                title="Duplicate Row"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteRow(resource);
                                                                }}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                                                                title="Delete Row"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    {/* Extra bottom space for comfortable scrolling and dropdown visibility */}
                    <div className="h-64 shrink-0 pointer-events-none" />
                </div>

                {/* Sliding details drawer integration */}
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
                                    isModified={false}
                                    onRevert={() => { }}
                                    onDelete={() => {
                                        const row = gridData.find(r => r.id === viewingResource);
                                        if (row) handleDeleteRow(row);
                                    }}
                                    showToast={showToast}
                                    setConfirmModal={setConfirmModal}
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
                        Showing <span className="font-semibold text-gray-600 dark:text-gray-300">{sortedGridData.length}</span> of <span className="font-semibold">{gridData.length}</span> rows
                    </p>
                    <p className="text-[10px] text-gray-400 select-none">
                        Shortcuts: Ctrl+Z (Undo) · Ctrl+Y (Redo) · Ctrl+A (Select All) · Del (Delete row or clear cells)
                    </p>
                </div>
            )}
        </div>
    );
};

export default ResourceList;
