import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Search, Plus, Trash2, Info, RefreshCw, Layers, Users, X, UploadCloud,
    Download, Save, RotateCcw, AlertCircle, ChevronDown, Copy, Eye, CheckSquare,
    Square, ArrowUp, ArrowDown, Filter, Sparkles, Check, Building, Briefcase, Globe, Phone, Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import clientApi from '../../services/clientApi';
import ClientDetails from './ClientDetails';
import ClientFilterDropdown from './ClientFilterDropdown';
import AddEditClient from './AddEditClient';
import ManageMetadataModal from '../../components/ManageMetadataModal';
import ConfirmModal from '../../components/ConfirmModal';
import DuplicateResolverModal from '../../components/DuplicateResolverModal';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const GRID_COLUMNS = [
    'name',
    'job_name',
    'sector_name',
    'contact_person',
    'designation',
    'telephone_no',
    'email',
    'address',
    'location',
    'remarks'
];

const COLUMN_LABELS = {
    name: 'Company Name',
    job_name: 'Nature of Job',
    sector_name: 'Sector',
    contact_person: 'Contact Person',
    designation: 'Designation',
    telephone_no: 'Contact No',
    email: 'Email ID',
    address: 'Address',
    location: 'Location',
    remarks: 'Remarks'
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

const CustomPageSizeDropdown = ({ pageSize, setPageSize, totalCount }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const options = [50, 100, 250, 500, 1000, 'All'];

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative inline-block text-left select-none" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all shadow-sm cursor-pointer"
            >
                <span>{pageSize === 'All' ? `All (${totalCount})` : `${pageSize} per page`}</span>
                <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 bottom-full mb-1 w-36 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-[7000] py-1 text-xs text-gray-700 dark:text-gray-300 font-semibold overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none">
                    <div className="px-2.5 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-white/5">
                        Rows per page
                    </div>
                    {options.map((opt) => (
                        <button
                            key={String(opt)}
                            onClick={() => {
                                setPageSize(opt);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center justify-between transition-colors ${pageSize === opt ? 'bg-blue-50/70 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold' : ''
                                }`}
                        >
                            <span>{opt === 'All' ? `All (${totalCount})` : `${opt} rows`}</span>
                            {pageSize === opt && <Check size={12} className="stroke-[3]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const renderFollowUpBadge = (followUpDateStr) => {
    if (!followUpDateStr) return null;
    let followUpDate = new Date(followUpDateStr);
    if (isNaN(followUpDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(followUpDate);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let formattedDate = followUpDateStr;
    try {
        formattedDate = format(followUpDate, 'dd MMM');
    } catch (e) {}

    if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        return (
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-500/30 shadow-xs shrink-0 cursor-pointer"
                title={`Follow-up was due on ${formattedDate}`}
            >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Overdue: {overdueDays}d ({formattedDate})
            </span>
        );
    } else if (diffDays === 0) {
        return (
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shadow-xs shrink-0 cursor-pointer"
                title="Follow-up scheduled for Today!"
            >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Follow-up Today!
            </span>
        );
    } else {
        return (
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 shadow-xs shrink-0 cursor-pointer"
                title={`Follow-up scheduled on ${formattedDate}`}
            >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Follow-up: {formattedDate}
            </span>
        );
    }
};

const ClientsList = () => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('clients', 2);

    const tableContainerRef = useRef(null);

    // Helper to get initial cached state for 0ms render time
    const getInitialClients = () => {
        try {
            const cached = sessionStorage.getItem('mano_clients_cache');
            if (cached) return JSON.parse(cached);
        } catch (e) { }
        return [];
    };

    const getInitialGridData = (clientsList) => {
        return clientsList.map(c => ({
            ...c,
            _status: 'saved',
            _errors: {}
        }));
    };

    const initialClients = getInitialClients();

    // Metadata & Original list
    const [clients, setClients] = useState(initialClients);
    const clientsRef = useRef(clients);
    clientsRef.current = clients;

    const [allJobNatures, setAllJobNatures] = useState([]);
    const [allSectors, setAllSectors] = useState([]);

    // Spreadsheet grid state
    const [gridData, setGridData] = useState(() => getInitialGridData(initialClients));
    const gridDataRef = useRef(gridData);
    gridDataRef.current = gridData;

    // Deleted IDs tracking for manual save
    const [deletedIds, setDeletedIds] = useState(new Set());

    const hasUnsavedChanges = useMemo(() => {
        const hasModified = gridData.some(r => (r._status === 'modified' || r._status === 'new') && r.name && r.name.trim());
        return hasModified || deletedIds.size > 0;
    }, [gridData, deletedIds]);

    const unsavedCount = useMemo(() => {
        const count = gridData.filter(r => (r._status === 'modified' || r._status === 'new') && r.name && r.name.trim()).length;
        return count + deletedIds.size;
    }, [gridData, deletedIds]);

    // Undo / Redo Stacks
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);

    const pushUndoState = (gridSnapshot) => {
        if (!gridSnapshot) return;
        const snapshotCopy = gridSnapshot.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
        undoStackRef.current.push(snapshotCopy);
        if (undoStackRef.current.length > 30) undoStackRef.current.shift();
        redoStackRef.current = [];
    };

    const [isLoading, setIsLoading] = useState(initialClients.length === 0);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState(null);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilters, setActiveFilters] = useState({ jobs: [], sectors: [] });
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [filterSectorSearch, setFilterSectorSearch] = useState('');
    const [filterJobSearch, setFilterJobSearch] = useState('');
    const filterDropdownRef = useRef(null);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [isJobNatureModalOpen, setIsJobNatureModalOpen] = useState(false);
    const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
    const [isManageDropdownOpen, setIsManageDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Selection & Bulk State
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [lastSelectedId, setLastSelectedId] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    // Toast & Confirm Modal
    const [toast, setToast] = useState(null);
    const showToast = (type, title, message, duration = 3000) => {
        setToast({ type, title, message, duration, id: Date.now() });
    };

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

    // Sidebar Detail Panel State
    const [viewingClient, setViewingClient] = useState(null);

    // Excel Cell Range Selection & Editing State
    const [selectionAnchor, setSelectionAnchor] = useState(null);
    const [selectionFocus, setSelectionFocus] = useState(null);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [editingCell, setEditingCell] = useState(null);

    // Custom In-Table Dropdowns State
    const [activeDropdownCell, setActiveDropdownCell] = useState(null);
    const [jobNatureSearch, setJobNatureSearch] = useState('');
    const [sectorSearch, setSectorSearch] = useState('');

    // Bulk Change Menus State
    const [showBulkJobMenu, setShowBulkJobMenu] = useState(false);
    const [showBulkSectorMenu, setShowBulkSectorMenu] = useState(false);
    const [bulkJobSearch, setBulkJobSearch] = useState('');
    const [bulkSectorSearch, setBulkSectorSearch] = useState('');

    const closeDropdown = () => {
        setActiveDropdownCell(null);
        setJobNatureSearch('');
        setSectorSearch('');
        setShowBulkJobMenu(false);
        setShowBulkSectorMenu(false);
        setBulkJobSearch('');
        setBulkSectorSearch('');
        setContextMenu(null);
    };

    const [contextMenu, setContextMenu] = useState(null);

    useEffect(() => {
        const handleCloseMenu = () => setContextMenu(null);
        window.addEventListener('click', handleCloseMenu);
        return () => window.removeEventListener('click', handleCloseMenu);
    }, []);

    const handleContextMenu = (e, rowIndex, colIndex) => {
        e.preventDefault();
        e.stopPropagation();

        const curBounds = bounds;
        if (!curBounds || rowIndex < curBounds.minRow || rowIndex > curBounds.maxRow || colIndex < curBounds.minCol || colIndex > curBounds.maxCol) {
            setSelectionAnchor({ r: rowIndex, c: colIndex });
            setSelectionFocus({ r: rowIndex, c: colIndex });
        }

        setContextMenu({
            x: Math.min(e.clientX, window.innerWidth - 240),
            y: Math.min(e.clientY, window.innerHeight - 380),
            rowIndex,
            colIndex
        });
    };

    const handleFillDown = () => {
        if (!bounds || bounds.minRow === bounds.maxRow || !canWrite) return;
        pushUndoState(gridDataRef.current);

        let updatedGrid = [...gridDataRef.current];
        const sourceRowObj = sortedGridDataRef.current[bounds.minRow];
        if (!sourceRowObj) return;

        for (let r = bounds.minRow + 1; r <= bounds.maxRow; r++) {
            const targetRowObj = sortedGridDataRef.current[r];
            if (!targetRowObj) continue;
            const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
            if (realIdx === -1) continue;

            const rowCopy = { ...updatedGrid[realIdx] };
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const col = GRID_COLUMNS[c];
                rowCopy[col] = sourceRowObj[col];
            }
            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
            updatedGrid[realIdx] = rowCopy;
        }

        setGridData(updatedGrid);
        showToast('sparkle', 'Fill Down (Ctrl+D)', `Filled values down across ${bounds.maxRow - bounds.minRow + 1} rows.`);
    };

    const handleFillRight = () => {
        if (!bounds || bounds.minCol === bounds.maxCol || !canWrite) return;
        pushUndoState(gridDataRef.current);

        let updatedGrid = [...gridDataRef.current];

        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const targetRowObj = sortedGridDataRef.current[r];
            if (!targetRowObj) continue;
            const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
            if (realIdx === -1) continue;

            const sourceColName = GRID_COLUMNS[bounds.minCol];
            const fillVal = targetRowObj[sourceColName];

            const rowCopy = { ...updatedGrid[realIdx] };
            for (let c = bounds.minCol + 1; c <= bounds.maxCol; c++) {
                const col = GRID_COLUMNS[c];
                rowCopy[col] = fillVal;
            }
            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
            updatedGrid[realIdx] = rowCopy;
        }

        setGridData(updatedGrid);
        showToast('sparkle', 'Fill Right (Ctrl+R)', `Filled values right across columns.`);
    };

    const handleInsertRow = (targetRowIndex, position = 'below') => {
        pushUndoState(gridDataRef.current);
        const insertIdx = position === 'above' ? targetRowIndex : targetRowIndex + 1;
        const newRow = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: '',
            job_name: '',
            sector_name: '',
            contact_person: '',
            designation: '',
            telephone_no: '',
            email: '',
            address: '',
            location: '',
            remarks: '',
            _status: 'new',
            _errors: {}
        };

        setGridData(prev => {
            const next = [...prev];
            next.splice(insertIdx, 0, newRow);
            return next;
        });

        setSelectionAnchor({ r: insertIdx, c: 0 });
        setSelectionFocus({ r: insertIdx, c: 0 });
        showToast('info', 'Row Inserted', `Inserted new row ${position} row #${targetRowIndex + 1}.`);
    };

    const executeCopy = () => {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') return;

        let rowsToCopy = [];
        let minCol = 0;
        let maxCol = GRID_COLUMNS.length - 1;

        const bounds = getSelectionBounds();

        if (selectedIds.size > 0) {
            rowsToCopy = sortedGridDataRef.current.filter(r => selectedIds.has(r.id));
        } else if (bounds) {
            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                if (sortedGridDataRef.current[r]) rowsToCopy.push(sortedGridDataRef.current[r]);
            }
            minCol = bounds.minCol;
            maxCol = bounds.maxCol;
        } else if (selectionAnchor) {
            const rowObj = sortedGridDataRef.current[selectionAnchor.r];
            if (rowObj) rowsToCopy.push(rowObj);
            minCol = selectionAnchor.c;
            maxCol = selectionAnchor.c;
        }

        if (rowsToCopy.length === 0) return;

        const tsvLines = rowsToCopy.map(rowObj => {
            const rowVals = [];
            for (let c = minCol; c <= maxCol; c++) {
                const colName = GRID_COLUMNS[c];
                rowVals.push(rowObj[colName] || '');
            }
            return rowVals.join('\t');
        });

        const tsvData = tsvLines.join('\n');
        if (tsvData) {
            navigator.clipboard.writeText(tsvData);
            const numCells = tsvLines.length * (maxCol - minCol + 1);
            showToast('sparkle', 'Copied to Clipboard', `Copied ${numCells} cell(s) across ${tsvLines.length} row(s)`);
        }
    };

    const executeCut = () => {
        if (!canWrite) return;
        executeCopy();
        pushUndoState(gridDataRef.current);
        const bounds = getSelectionBounds();

        if (selectedIds.size > 0) {
            handleBulkDelete();
            return;
        }

        if (!bounds) return;
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
                rowCopy[col] = '';
                numCleared++;
            }
            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
            updatedGrid[realIdx] = rowCopy;
        }

        if (numCleared > 0) {
            setGridData(updatedGrid);
            showToast('sparkle', 'Cut to Clipboard', `Cut values from ${numCleared} cell(s).`);
        }
    };

    const executePaste = async (pastedText = null) => {
        let textToPaste = pastedText;
        if (!textToPaste) {
            try {
                textToPaste = await navigator.clipboard.readText();
            } catch (err) {
                console.error('Clipboard access error', err);
            }
        }
        if (!textToPaste || !textToPaste.trim()) return;

        pushUndoState(gridDataRef.current);

        let startRow = 0;
        let startCol = 0;

        const bounds = getSelectionBounds();

        if (selectedIds.size > 0) {
            const firstSelectedId = Array.from(selectedIds)[0];
            const foundIdx = sortedGridDataRef.current.findIndex(r => r.id === firstSelectedId);
            if (foundIdx !== -1) startRow = foundIdx;
        } else if (bounds) {
            startRow = bounds.minRow;
            startCol = bounds.minCol;
        } else if (selectionAnchor) {
            startRow = selectionAnchor.r;
            startCol = selectionAnchor.c;
        }

        const lines = textToPaste.trim().split(/\r?\n/);
        let updatedGrid = [...gridDataRef.current];
        let numCellsUpdated = 0;
        let newRowsAddedCount = 0;

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
                            rowCopy[colName] = cellVal.trim();
                            numCellsUpdated++;
                        }
                    });
                    if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                    updatedGrid[realIdx] = rowCopy;
                }
            } else {
                const newRow = {
                    id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${dr}`,
                    name: '',
                    job_name: '',
                    sector_name: '',
                    contact_person: '',
                    designation: '',
                    telephone_no: '',
                    email: '',
                    address: '',
                    location: '',
                    remarks: '',
                    _status: 'new',
                    _errors: {}
                };
                cells.forEach((cellVal, dc) => {
                    const c = startCol + dc;
                    if (c < GRID_COLUMNS.length) {
                        const colName = GRID_COLUMNS[c];
                        newRow[colName] = cellVal.trim();
                        numCellsUpdated++;
                    }
                });
                if (!newRow.name) {
                    const nonVal = cells.find(c => c.trim());
                    if (nonVal) newRow.name = nonVal.trim();
                }
                if (newRow.name) {
                    updatedGrid.push(newRow);
                    newRowsAddedCount++;
                }
            }
        });

        if (numCellsUpdated > 0) {
            setGridData(updatedGrid);
            if (newRowsAddedCount > 0) {
                showToast('sparkle', 'Added New Rows', `Pasted ${newRowsAddedCount} new row(s) into spreadsheet`);
            } else {
                showToast('sparkle', 'Paste Success', `Pasted content into ${numCellsUpdated} cell(s).`);
            }
        }
    };

    // Global MouseUp for range drag selection
    useEffect(() => {
        const handleGlobalMouseUp = () => setIsMouseDown(false);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // Global click outside & keydown listener
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (e.target.closest('.z-\\[6000\\]') || e.target.closest('.z-\\[9999\\]') || e.target.closest('[role="dialog"]')) {
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

    // High-performance viewport scroll & auto-focus engine (0ms reflow overhead)
    useEffect(() => {
        if (selectionFocus && sortedGridDataRef.current && sortedGridDataRef.current[selectionFocus.r]) {
            const colName = GRID_COLUMNS[selectionFocus.c];
            if (colName) {
                const cellEl = document.getElementById(`cell-${selectionFocus.r}-${colName}`);
                if (cellEl) {
                    if (document.activeElement !== cellEl && !editingCell) {
                        cellEl.focus({ preventScroll: true });
                    }
                    const container = cellEl.closest('.overflow-auto');
                    if (container) {
                        const cellRect = cellEl.getBoundingClientRect();
                        const containerRect = container.getBoundingClientRect();
                        if (cellRect.top < containerRect.top + 32) {
                            container.scrollTop -= (containerRect.top + 32 - cellRect.top);
                        } else if (cellRect.bottom > containerRect.bottom - 12) {
                            container.scrollTop += (cellRect.bottom - (containerRect.bottom - 12));
                        }
                        if (cellRect.left < containerRect.left + 50) {
                            container.scrollLeft -= (containerRect.left + 50 - cellRect.left);
                        } else if (cellRect.right > containerRect.right - 50) {
                            container.scrollLeft += (cellRect.right - (containerRect.right - 50));
                        }
                    }
                }
            }
        }
    }, [selectionFocus, editingCell]);

    const bounds = useMemo(() => {
        if (!selectionAnchor) return null;
        const focus = selectionFocus || selectionAnchor;
        const minRow = Math.min(selectionAnchor.r, focus.r);
        const maxRow = Math.max(selectionAnchor.r, focus.r);
        const minCol = Math.min(selectionAnchor.c, focus.c);
        const maxCol = Math.max(selectionAnchor.c, focus.c);
        return { minRow, maxRow, minCol, maxCol };
    }, [selectionAnchor, selectionFocus]);

    // Stats calculations
    const stats = useMemo(() => ({
        total: clients.length,
        jobNaturesCount: allJobNatures.length,
        sectorsCount: allSectors.length,
        hasPhone: clients.filter(c => c.telephone_no || c.mobile).length
    }), [clients, allJobNatures, allSectors]);

    const fetchMetadata = async () => {
        try {
            const [jobRes, sectorRes] = await Promise.all([
                api.get('/admin/job-natures'),
                api.get('/admin/sectors')
            ]);
            if (jobRes.data.success) setAllJobNatures(jobRes.data.job_natures || []);
            if (sectorRes.data.success) setAllSectors(sectorRes.data.sectors || []);
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
        }
    };

    const fetchClients = async (isManualRefresh = false) => {
        if (clientsRef.current.length === 0) {
            setIsLoading(true);
        }
        try {
            const params = { limit: 1000 };
            const resData = await clientApi.getClients(params);
            const fetchedList = resData.clients || [];

            try {
                sessionStorage.setItem('mano_clients_cache', JSON.stringify(fetchedList));
            } catch (e) { }

            setClients(fetchedList);

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
                showToast('info', 'Refreshed', 'Client list updated from server.');
            }
        } catch (error) {
            console.error('Failed to fetch clients', error);
            showToast('error', 'Fetch Error', error.response?.data?.message || 'Failed to load clients', 5000);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMetadata();
        fetchClients();
    }, []);

    // Close Manage dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsManageDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─── Manual Batch Save Engine ──────────────────────────────────────────────
    const saveGridRows = async () => {
        const targetGrid = gridDataRef.current;
        const newRows = targetGrid.filter(r => r._status === 'new' && r.name && r.name.trim());
        const modifiedRows = targetGrid.filter(r => r._status === 'modified' && r.name && r.name.trim());
        const pendingDeleteIds = Array.from(deletedIds);

        if (newRows.length === 0 && modifiedRows.length === 0 && pendingDeleteIds.length === 0) {
            showToast('info', 'No Changes', 'There are no unsaved changes to save.');
            return;
        }

        setIsSaving(true);
        try {
            if (pendingDeleteIds.length > 0) {
                await clientApi.deleteClients(pendingDeleteIds);
                setDeletedIds(new Set());
            }

            const savedClientIds = new Set(clientsRef.current.map(c => c.id));
            const validModifiedRows = [];
            const newPayloadRows = [...newRows];

            modifiedRows.forEach(r => {
                if (savedClientIds.has(r.id)) {
                    validModifiedRows.push(r);
                } else {
                    newPayloadRows.push(r);
                }
            });

            const createdResults = [];
            if (newPayloadRows.length > 0) {
                for (const row of newPayloadRows) {
                    const { id, _status, _errors, ...payload } = row;
                    const res = await clientApi.createClient(payload);
                    if (res && res.id) {
                        createdResults.push({ tempId: id, realId: res.id, ...payload });
                    }
                }
            }

            if (validModifiedRows.length > 0) {
                for (const row of validModifiedRows) {
                    const { id, _status, _errors, ...payload } = row;
                    await clientApi.updateClient(id, payload);
                }
            }

            setGridData(prevGrid => {
                const createdMap = new Map(createdResults.map(item => [item.tempId, item.realId]));

                return prevGrid.map(row => {
                    if (validModifiedRows.some(m => m.id === row.id)) {
                        return { ...row, _status: 'saved', _errors: {} };
                    }
                    if (createdMap.has(row.id)) {
                        return {
                            ...row,
                            id: createdMap.get(row.id),
                            _status: 'saved',
                            _errors: {}
                        };
                    }
                    return row;
                });
            });

            setClients(prev => {
                const updated = prev.filter(c => !pendingDeleteIds.includes(c.id));
                validModifiedRows.forEach(mod => {
                    const idx = updated.findIndex(c => c.id === mod.id);
                    if (idx !== -1) updated[idx] = { ...updated[idx], ...mod, _status: 'saved' };
                });
                createdResults.forEach(c => {
                    if (!updated.some(cli => cli.id === c.realId)) {
                        updated.push({ id: c.realId, ...c, _status: 'saved' });
                    }
                });
                return updated;
            });

            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setLastSavedTime(timeStr);
            showToast('success', 'Changes Saved', 'All changes have been successfully saved to database & cloud.');
        } catch (err) {
            console.error('Failed to save client grid', err);
            showToast('error', 'Save Error', err.response?.data?.message || 'Failed to save client changes', 5000);
        } finally {
            setIsSaving(false);
        }
    };

    // Filter & Sort Grid Data
    const filteredGridData = useMemo(() => {
        if (!searchTerm && activeFilters.jobs.length === 0 && activeFilters.sectors.length === 0) {
            return gridData;
        }
        const lowerSearch = searchTerm.toLowerCase();
        return gridData.filter(r => {
            const matchesSearch = !searchTerm ||
                (r.name || '').toLowerCase().includes(lowerSearch) ||
                (r.job_name || '').toLowerCase().includes(lowerSearch) ||
                (r.sector_name || '').toLowerCase().includes(lowerSearch) ||
                (r.contact_person || '').toLowerCase().includes(lowerSearch) ||
                (r.telephone_no || '').toLowerCase().includes(lowerSearch) ||
                (r.email || '').toLowerCase().includes(lowerSearch) ||
                (r.address || '').toLowerCase().includes(lowerSearch);

            const matchesJobFilter = activeFilters.jobs.length === 0 || activeFilters.jobs.includes(r.job_name);
            const matchesSectorFilter = activeFilters.sectors.length === 0 || activeFilters.sectors.includes(r.sector_name);

            return matchesSearch && matchesJobFilter && matchesSectorFilter;
        });
    }, [gridData, searchTerm, activeFilters]);

    const sortedGridData = useMemo(() => {
        if (!sortConfig.key) return filteredGridData;
        return [...filteredGridData].sort((a, b) => {
            // Keep newly added/unsaved rows at the bottom below older ones
            const aIsNew = a._status === 'new' || String(a.id).startsWith('temp_');
            const bIsNew = b._status === 'new' || String(b.id).startsWith('temp_');
            if (aIsNew && !bIsNew) return 1;
            if (!aIsNew && bIsNew) return -1;

            let aVal = a[sortConfig.key] || '';
            let bVal = b[sortConfig.key] || '';
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredGridData, sortConfig]);

    const sortedGridDataRef = useRef(sortedGridData);
    sortedGridDataRef.current = sortedGridData;

    // Pagination States & Memoization
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(100); // Options: 50, 100, 250, 500, 1000, 'All'

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeFilters, pageSize]);

    const totalPages = useMemo(() => {
        if (pageSize === 'All') return 1;
        return Math.ceil(sortedGridData.length / Number(pageSize)) || 1;
    }, [sortedGridData.length, pageSize]);

    const paginatedGridData = useMemo(() => {
        if (pageSize === 'All') return sortedGridData;
        const size = Number(pageSize);
        const start = (currentPage - 1) * size;
        return sortedGridData.slice(start, start + size);
    }, [sortedGridData, currentPage, pageSize]);

    // ─── Global Keyboard Shortcuts (Ctrl+A, Ctrl+Z, Ctrl+Y) ────────────────────
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

            // Delete or Backspace key
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (canWrite) {
                    const bounds = getSelectionBounds();
                    if (selectedIds.size > 0) {
                        e.preventDefault();
                        handleBulkDelete();
                        return;
                    } else if (bounds) {
                        e.preventDefault();
                        const totalCols = GRID_COLUMNS.length;
                        const isFullRowSelected = (bounds.minCol === 0 && bounds.maxCol === totalCols - 1);
                        if (isFullRowSelected) {
                            const rowsToDelete = [];
                            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                                const targetRowObj = sortedGridDataRef.current[r];
                                if (targetRowObj) rowsToDelete.push(targetRowObj);
                            }
                            if (rowsToDelete.length > 0) {
                                deleteSelectedRowEntries(rowsToDelete);
                            }
                        } else {
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
                                    rowCopy[col] = '';
                                    numCleared++;
                                }
                                if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                                updatedGrid[realIdx] = rowCopy;
                            }

                            if (numCleared > 0) {
                                setGridData(updatedGrid);
                                showToast('info', 'Cells Cleared', `Cleared content from ${numCleared} cell(s). Click "Save Changes" to apply.`);
                            }
                        }
                        return;
                    }
                }
            }

            // Ctrl+C / Cmd+C : Copy
            if (modifier && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                executeCopy();
                return;
            }

            // Ctrl+X / Cmd+X : Cut
            if (modifier && (e.key === 'x' || e.key === 'X')) {
                if (canWrite) {
                    e.preventDefault();
                    executeCut();
                    return;
                }
            }

            // Ctrl+V / Cmd+V : Paste
            if (modifier && (e.key === 'v' || e.key === 'V')) {
                if (canWrite) {
                    e.preventDefault();
                    executePaste();
                    return;
                }
            }

            // Ctrl+A / Cmd+A : Select All
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
                    showToast('sparkle', 'Redo Successful', 'Restored redone spreadsheet state');
                } else {
                    showToast('info', 'Redo', 'No actions to redo');
                }
                return;
            }
        };

        window.addEventListener('keydown', handleGlobalShortcuts);
        return () => window.removeEventListener('keydown', handleGlobalShortcuts);
    }, [selectedIds, selectionAnchor, selectionFocus]);

    // ─── Cell Copy (Ctrl+C) & Cell Paste (Ctrl+V) ──────────────────────────────
    useEffect(() => {
        const handleGlobalCopy = (e) => {
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;

            let rowsToCopy = [];
            if (selectedIds.size > 0) {
                rowsToCopy = sortedGridDataRef.current.filter(r => selectedIds.has(r.id));
            } else if (bounds) {
                for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                    if (sortedGridDataRef.current[r]) rowsToCopy.push(sortedGridDataRef.current[r]);
                }
            }

            if (rowsToCopy.length === 0) return;

            e.preventDefault();
            const minCol = (selectedIds.size > 0 || !bounds) ? 0 : bounds.minCol;
            const maxCol = (selectedIds.size > 0 || !bounds) ? GRID_COLUMNS.length - 1 : bounds.maxCol;

            const tsvLines = rowsToCopy.map(rowObj => {
                const rowVals = [];
                for (let c = minCol; c <= maxCol; c++) {
                    const colName = GRID_COLUMNS[c];
                    rowVals.push(rowObj[colName] || '');
                }
                return rowVals.join('\t');
            });

            const tsvData = tsvLines.join('\n');
            if (tsvData) {
                navigator.clipboard.writeText(tsvData);
                const numCells = tsvLines.length * (maxCol - minCol + 1);
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

            const selectedBounds = bounds;
            const startRow = selectedBounds ? selectedBounds.minRow : sortedGridDataRef.current.length;
            const startCol = selectedBounds ? selectedBounds.minCol : 0;

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
                                rowCopy[colName] = cellVal.trim();
                                numCellsUpdated++;
                            }
                        });
                        if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                        updatedGrid[realIdx] = rowCopy;
                    }
                } else {
                    let name = cells[0]?.trim() || '';
                    let job_name = cells[1]?.trim() || '';
                    let sector_name = cells[2]?.trim() || '';
                    let contact_person = cells[3]?.trim() || '';
                    let designation = cells[4]?.trim() || '';
                    let telephone_no = cells[5]?.trim() || '';
                    let email = cells[6]?.trim() || '';
                    let address = cells[7]?.trim() || '';
                    let location = cells[8]?.trim() || '';
                    let remarks = cells[9]?.trim() || '';

                    if (!name) {
                        const nonVal = cells.find(c => c.trim());
                        if (nonVal) name = nonVal.trim();
                    }

                    if (name) {
                        const newRowIdx = updatedGrid.length;
                        if (firstNewRowIndex === -1) firstNewRowIndex = newRowIdx;

                        updatedGrid.push({
                            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${dr}`,
                            name,
                            job_name,
                            sector_name,
                            contact_person,
                            designation,
                            telephone_no,
                            email,
                            address,
                            location,
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
                    showToast('sparkle', 'Added New Rows', `Pasted ${newRowsAddedCount} new client row(s) into spreadsheet`);
                } else {
                    showToast('sparkle', 'Excel Paste Success', `Pasted values into ${numCellsUpdated} cell(s) across spreadsheet`);
                }
                if (firstNewRowIndex !== -1) {
                    setSelectionAnchor({ r: firstNewRowIndex, c: 0 });
                    setSelectionFocus({ r: updatedGrid.length - 1, c: GRID_COLUMNS.length - 1 });
                }
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

    const handleSelectAll = (e) => {
        e?.stopPropagation();
        if (selectedIds.size === sortedGridData.length) {
            setSelectedIds(new Set());
            setSelectionAnchor(null);
            setSelectionFocus(null);
        } else {
            const allIds = new Set(sortedGridData.map(r => r.id));
            setSelectedIds(allIds);
            if (sortedGridData.length > 0) {
                setSelectionAnchor({ r: 0, c: 0 });
                setSelectionFocus({
                    r: sortedGridData.length - 1,
                    c: GRID_COLUMNS.length - 1
                });
            }
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

            if (next.size > 0) {
                const selectedIndices = sortedGridData
                    .map((r, idx) => next.has(r.id) ? idx : -1)
                    .filter(idx => idx !== -1);
                if (selectedIndices.length > 0) {
                    const minR = Math.min(...selectedIndices);
                    const maxR = Math.max(...selectedIndices);
                    setSelectionAnchor({ r: minR, c: 0 });
                    setSelectionFocus({ r: maxR, c: GRID_COLUMNS.length - 1 });
                }
            } else {
                setSelectionAnchor(null);
                setSelectionFocus(null);
            }

            return next;
        });
        setLastSelectedId(id);
    };

    // Cell Management
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

            const errors = { ...(row._errors || {}) };
            if (field === 'name') {
                if (!value || !value.trim()) errors.name = 'Company Name is required';
                else delete errors.name;
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
    };

    const handleCellBlur = () => {
        setEditingCell(null);
    };

    const deleteSelectedRowEntries = async (rowsToDelete) => {
        pushUndoState(gridDataRef.current);
        const rowIds = new Set(rowsToDelete.map(r => r.id));
        const savedIds = rowsToDelete.filter(r => !String(r.id).startsWith('temp_')).map(r => r.id);

        setClients(prev => prev.filter(r => !rowIds.has(r.id)));
        setGridData(prev => prev.filter(r => !rowIds.has(r.id)));
        setSelectedIds(prev => {
            const next = new Set(prev);
            rowIds.forEach(id => next.delete(id));
            return next;
        });
        setSelectionAnchor(null);
        setSelectionFocus(null);
        showToast('success', 'Entry Deleted', `Deleted ${rowsToDelete.length} client entry(ies) locally. Click "Save Changes" to apply.`);

        if (savedIds.length > 0) {
            setDeletedIds(prev => new Set([...prev, ...savedIds]));
        }
    };

    // Keyboard navigation & Excel shortcuts engine
    const handleCellKeyDown = (e, rowIndex, colName) => {
        const colIndex = GRID_COLUMNS.indexOf(colName);
        const totalRows = sortedGridData.length;
        const totalCols = GRID_COLUMNS.length;
        const isModifier = e.ctrlKey || e.metaKey;

        if (editingCell?.rowIndex === rowIndex && editingCell?.colName === colName) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCellBlur();
                const nextRow = e.shiftKey ? Math.max(0, rowIndex - 1) : Math.min(totalRows - 1, rowIndex + 1);
                setSelectionAnchor({ r: nextRow, c: colIndex });
                setSelectionFocus({ r: nextRow, c: colIndex });
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditingCell(null);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                handleCellBlur();
                let nextCol = e.shiftKey ? colIndex - 1 : colIndex + 1;
                let nextRow = rowIndex;
                if (nextCol < 0) {
                    if (rowIndex > 0) {
                        nextRow = rowIndex - 1;
                        nextCol = totalCols - 1;
                    } else {
                        nextCol = 0;
                    }
                } else if (nextCol >= totalCols) {
                    if (rowIndex < totalRows - 1) {
                        nextRow = rowIndex + 1;
                        nextCol = 0;
                    } else {
                        nextCol = totalCols - 1;
                    }
                }
                setSelectionAnchor({ r: nextRow, c: nextCol });
                setSelectionFocus({ r: nextRow, c: nextCol });
            }
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (bounds && canWrite) {
                e.preventDefault();
                const isFullRowSelected = (bounds.minCol === 0 && bounds.maxCol === totalCols - 1);
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
                        if (col !== 'name') {
                            rowCopy[col] = '';
                            numCleared++;
                        }
                    }
                    if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                    updatedGrid[realIdx] = rowCopy;
                }

                if (numCleared > 0) {
                    setGridData(updatedGrid);
                    showToast('info', 'Cells Cleared', `Cleared content from ${numCleared} cell(s). Click "Save Changes" to apply.`);
                }
            }
            return;
        }

        const curFocus = selectionFocus || { r: rowIndex, c: colIndex };
        const curAnchor = selectionAnchor || { r: rowIndex, c: colIndex };

        // Arrow navigation (Up, Down, Left, Right)
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const targetRow = isModifier ? 0 : Math.max(0, curFocus.r - 1);
            if (e.shiftKey) {
                setSelectionAnchor(curAnchor);
                setSelectionFocus({ r: targetRow, c: curFocus.c });
            } else {
                setSelectionAnchor({ r: targetRow, c: curFocus.c });
                setSelectionFocus({ r: targetRow, c: curFocus.c });
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const targetRow = isModifier ? Math.max(0, totalRows - 1) : Math.min(Math.max(0, totalRows - 1), curFocus.r + 1);
            if (e.shiftKey) {
                setSelectionAnchor(curAnchor);
                setSelectionFocus({ r: targetRow, c: curFocus.c });
            } else {
                setSelectionAnchor({ r: targetRow, c: curFocus.c });
                setSelectionFocus({ r: targetRow, c: curFocus.c });
            }
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const targetCol = isModifier ? 0 : Math.max(0, curFocus.c - 1);
            if (e.shiftKey) {
                setSelectionAnchor(curAnchor);
                setSelectionFocus({ r: curFocus.r, c: targetCol });
            } else {
                setSelectionAnchor({ r: curFocus.r, c: targetCol });
                setSelectionFocus({ r: curFocus.r, c: targetCol });
            }
            return;
        }

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const targetCol = isModifier ? totalCols - 1 : Math.min(totalCols - 1, curFocus.c + 1);
            if (e.shiftKey) {
                setSelectionAnchor(curAnchor);
                setSelectionFocus({ r: curFocus.r, c: targetCol });
            } else {
                setSelectionAnchor({ r: curFocus.r, c: targetCol });
                setSelectionFocus({ r: curFocus.r, c: targetCol });
            }
            return;
        }

        // Home & End keys
        if (e.key === 'Home') {
            e.preventDefault();
            const targetRow = isModifier ? 0 : curFocus.r;
            const targetCol = 0;
            if (e.shiftKey) {
                setSelectionAnchor(curAnchor);
                setSelectionFocus({ r: targetRow, c: targetCol });
            } else {
                setSelectionAnchor({ r: targetRow, c: targetCol });
                setSelectionFocus({ r: targetRow, c: targetCol });
            }
            return;
        }

        if (e.key === 'End') {
            e.preventDefault();
            const targetRow = isModifier ? Math.max(0, totalRows - 1) : curFocus.r;
            const targetCol = totalCols - 1;
            if (e.shiftKey) {
                setSelectionAnchor(curAnchor);
                setSelectionFocus({ r: targetRow, c: targetCol });
            } else {
                setSelectionAnchor({ r: targetRow, c: targetCol });
                setSelectionFocus({ r: targetRow, c: targetCol });
            }
            return;
        }

        // PageUp & PageDown
        if (e.key === 'PageUp') {
            e.preventDefault();
            const targetRow = Math.max(0, curFocus.r - 10);
            if (e.shiftKey) {
                setSelectionAnchor(curAnchor);
                setSelectionFocus({ r: targetRow, c: curFocus.c });
            } else {
                setSelectionAnchor({ r: targetRow, c: curFocus.c });
                setSelectionFocus({ r: targetRow, c: curFocus.c });
            }
            return;
        }

        if (e.key === 'PageDown') {
            e.preventDefault();
            const targetRow = Math.min(Math.max(0, totalRows - 1), curFocus.r + 10);
            if (e.shiftKey) {
                setSelectionAnchor(curAnchor);
                setSelectionFocus({ r: targetRow, c: curFocus.c });
            } else {
                setSelectionAnchor({ r: targetRow, c: curFocus.c });
                setSelectionFocus({ r: targetRow, c: curFocus.c });
            }
            return;
        }

        // Tab / Shift+Tab
        if (e.key === 'Tab') {
            e.preventDefault();
            let nextCol = e.shiftKey ? curFocus.c - 1 : curFocus.c + 1;
            let nextRow = curFocus.r;
            if (nextCol < 0) {
                if (curFocus.r > 0) {
                    nextRow = curFocus.r - 1;
                    nextCol = totalCols - 1;
                } else {
                    nextCol = 0;
                }
            } else if (nextCol >= totalCols) {
                if (curFocus.r < totalRows - 1) {
                    nextRow = curFocus.r + 1;
                    nextCol = 0;
                } else {
                    nextCol = totalCols - 1;
                }
            }
            setSelectionAnchor({ r: nextRow, c: nextCol });
            setSelectionFocus({ r: nextRow, c: nextCol });
            return;
        }

        // Enter / Shift+Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextRow = e.shiftKey ? Math.max(0, curFocus.r - 1) : Math.min(Math.max(0, totalRows - 1), curFocus.r + 1);
            setSelectionAnchor({ r: nextRow, c: curFocus.c });
            setSelectionFocus({ r: nextRow, c: curFocus.c });
            return;
        }

        // Spacebar selection (Shift+Space: Rows, Ctrl+Space: Columns)
        if (e.key === ' ' || e.key === 'Spacebar') {
            if (e.shiftKey && !isModifier) {
                e.preventDefault();
                const activeBounds = bounds || { minRow: curFocus.r, maxRow: curFocus.r };
                const selectedRowIds = new Set();
                for (let r = activeBounds.minRow; r <= activeBounds.maxRow; r++) {
                    const targetRowObj = sortedGridDataRef.current[r];
                    if (targetRowObj) selectedRowIds.add(targetRowObj.id);
                }
                setSelectedIds(selectedRowIds);
                setSelectionAnchor({ r: activeBounds.minRow, c: 0 });
                setSelectionFocus({ r: activeBounds.maxRow, c: totalCols - 1 });
                return;
            }
            if (isModifier && !e.shiftKey) {
                e.preventDefault();
                const activeBounds = bounds || { minCol: curFocus.c, maxCol: curFocus.c };
                setSelectionAnchor({ r: 0, c: activeBounds.minCol });
                setSelectionFocus({ r: Math.max(0, totalRows - 1), c: activeBounds.maxCol });
                return;
            }
        }

        // F2 edit mode
        if (e.key === 'F2') {
            e.preventDefault();
            if (canWrite) {
                if (colName === 'job_name' || colName === 'sector_name') {
                    setActiveDropdownCell({ rowIndex: curFocus.r, colName });
                } else {
                    setEditingCell({ rowIndex: curFocus.r, colName });
                }
            }
            return;
        }

        // Direct typing replaces cell content
        if (canWrite && e.key.length === 1 && !isModifier && !e.altKey) {
            if (colName !== 'job_name' && colName !== 'sector_name') {
                setEditingCell({ rowIndex: curFocus.r, colName });
                handleCellChange(curFocus.r, colName, e.key);
            }
        }
    };

    // Add Row
    const handleAddRows = (count = 1) => {
        pushUndoState(gridDataRef.current);
        const newRows = Array.from({ length: count }).map((_, idx) => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${idx}`,
            name: '',
            job_name: '',
            sector_name: '',
            contact_person: '',
            designation: '',
            telephone_no: '',
            email: '',
            address: '',
            location: '',
            remarks: '',
            _status: 'new',
            _errors: {}
        }));
        setGridData(prev => [...prev, ...newRows]);
        showToast('info', 'Rows Added', `Added ${count} new client row(s).`);
    };

    // Duplicate Row
    const handleDuplicateRow = (row) => {
        pushUndoState(gridDataRef.current);
        const duplicate = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${Math.floor(Math.random() * 1000)}`,
            name: row.name ? `${row.name} (Copy)` : 'New Copy',
            job_name: row.job_name || '',
            sector_name: row.sector_name || '',
            contact_person: row.contact_person || '',
            designation: row.designation || '',
            telephone_no: row.telephone_no || '',
            email: row.email || '',
            address: row.address || '',
            location: row.location || '',
            remarks: row.remarks || '',
            _status: 'new',
            _errors: {}
        };
        let updatedGrid = [];
        setGridData(prev => {
            updatedGrid = [...prev, duplicate];
            return updatedGrid;
        });
        showToast('sparkle', 'Row Duplicated', `Duplicated "${row.name || 'client'}".`);
        setTimeout(() => saveGridRows(updatedGrid), 150);
    };

    // Remove Duplicate Clients Modal Handler
    const handleRemoveDuplicates = () => {
        setIsDuplicateModalOpen(true);
    };

    const handleConfirmDeleteDuplicates = async (idsToDelete) => {
        if (!idsToDelete || idsToDelete.length === 0) return;
        pushUndoState(gridDataRef.current);
        setGridData(prev => prev.filter(r => !idsToDelete.includes(r.id)));
        setSelectedIds(new Set());

        const savedRemovedIds = idsToDelete.filter(id => !String(id).startsWith('temp_'));
        if (savedRemovedIds.length > 0) {
            setDeletedIds(prev => new Set([...prev, ...savedRemovedIds]));
            setClients(prev => prev.filter(c => !savedRemovedIds.includes(c.id)));
        }

        showToast('success', 'Duplicates Removed', `Removed ${idsToDelete.length} selected duplicate client(s) locally. Click "Save Changes" to apply.`);
    };

    // Bulk Actions
    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;

        setConfirmModal({
            isOpen: true,
            title: 'Delete Selected Clients?',
            message: `Are you sure you want to delete ${selectedIds.size} selected client(s)? Click "Save Changes" after deletion to apply to cloud.`,
            confirmText: `Delete (${selectedIds.size})`,
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                pushUndoState(gridDataRef.current);
                const idsToDelete = Array.from(selectedIds);
                const savedIds = idsToDelete.filter(id => !String(id).startsWith('temp_'));
                const count = selectedIds.size;

                setClients(prev => prev.filter(r => !selectedIds.has(r.id)));
                setGridData(prev => prev.filter(r => !selectedIds.has(r.id)));
                setSelectedIds(new Set());
                if (viewingClient && selectedIds.has(viewingClient.id)) {
                    setViewingClient(null);
                }
                closeConfirmModal();
                showToast('success', 'Bulk Delete Successful', `Deleted ${count} selected client(s) locally. Click "Save Changes" to apply.`);

                if (savedIds.length > 0) {
                    setDeletedIds(prev => new Set([...prev, ...savedIds]));
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
            name: row.name ? `${row.name} (Copy)` : 'Copy',
            job_name: row.job_name || '',
            sector_name: row.sector_name || '',
            contact_person: row.contact_person || '',
            designation: row.designation || '',
            telephone_no: row.telephone_no || '',
            email: row.email || '',
            address: row.address || '',
            location: row.location || '',
            remarks: row.remarks || '',
            _status: 'new',
            _errors: {}
        }));
        setGridData(prev => [...prev, ...duplicates]);
        const count = selectedIds.size;
        setSelectedIds(new Set());
        showToast('sparkle', 'Bulk Duplicated', `Created ${count} client duplicate(s). Click "Save Changes" to apply.`);
    };

    const handleBulkChangeJob = (newJobName) => {
        if (selectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);
        const count = selectedIds.size;
        setGridData(prev => prev.map(row => {
            if (selectedIds.has(row.id)) {
                return {
                    ...row,
                    job_name: newJobName,
                    _status: row._status === 'new' ? 'new' : 'modified'
                };
            }
            return row;
        }));
        closeDropdown();
        showToast('sparkle', 'Job Nature Updated', `Changed Job Nature to "${newJobName}" for ${count} row(s). Click "Save Changes" to apply.`);
    };

    const handleBulkChangeSector = (newSectorName) => {
        if (selectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);
        const count = selectedIds.size;
        setGridData(prev => prev.map(row => {
            if (selectedIds.has(row.id)) {
                return {
                    ...row,
                    sector_name: newSectorName,
                    _status: row._status === 'new' ? 'new' : 'modified'
                };
            }
            return row;
        }));
        closeDropdown();
        showToast('sparkle', 'Sector Updated', `Changed Sector to "${newSectorName}" for ${count} row(s). Click "Save Changes" to apply.`);
    };

    const handleDeleteRow = (row) => {
        if (row._status === 'new') {
            pushUndoState(gridDataRef.current);
            setGridData(prev => prev.filter(r => r.id !== row.id));
            showToast('info', 'Row Removed', 'Removed newly added row.');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Delete Client?',
            message: `Are you sure you want to delete "${row.name || 'this client'}"? Click "Save Changes" after deletion to apply to cloud.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                pushUndoState(gridDataRef.current);
                setClients(prev => prev.filter(r => r.id !== row.id));
                setGridData(prev => prev.filter(r => r.id !== row.id));
                if (viewingClient?.id === row.id) {
                    setViewingClient(null);
                }
                closeConfirmModal();
                showToast('success', 'Client Deleted', `Deleted "${row.name || 'Client'}" locally. Click "Save Changes" to apply.`);
                if (!String(row.id).startsWith('temp_')) {
                    setDeletedIds(prev => new Set([...prev, row.id]));
                }
            }
        });
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = ['Company Name', 'Nature of Job', 'Sector', 'Contact Person', 'Designation', 'Contact No', 'Email ID', 'Address', 'Location', 'Remarks'];
        const csvRows = sortedGridData.map(r => [
            r.name || '',
            r.job_name || '',
            r.sector_name || '',
            r.contact_person || '',
            r.designation || '',
            r.telephone_no || '',
            r.email || '',
            r.address || '',
            r.location || '',
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
        link.setAttribute("download", `mano_clients_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('success', 'Export Complete', `Exported ${sortedGridData.length} clients to CSV.`);
    };

    const handleSaveClientFromModal = async (clientData) => {
        try {
            if (editingClient) {
                const res = await api.put(`/clients/${editingClient.id}`, clientData);
                if (res.data.success) {
                    showToast('success', 'Client Updated', 'Client saved successfully');
                    fetchClients();
                    fetchMetadata();
                }
            } else {
                const res = await api.post('/clients', clientData);
                if (res.data.success) {
                    showToast('success', 'Client Added', 'New client created');
                    fetchClients();
                    fetchMetadata();
                }
            }
            setIsAddModalOpen(false);
            setEditingClient(null);
        } catch (err) {
            showToast('error', 'Save Failed', err.response?.data?.message || 'Failed to save client');
        }
    };

    const handleViewClientDetails = async (client) => {
        try {
            const res = await clientApi.getClientById(client.id);
            if (res && res.client) {
                setViewingClient(res.client);
            } else {
                setViewingClient(client);
            }
        } catch (err) {
            setViewingClient(client);
        }
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full relative">

            {/* Custom Confirm Modal */}
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

            {/* Toast Notification */}
            <Toast toast={toast} onClose={() => setToast(null)} />

            {/* Stats Header */}
            <div className="px-3 pt-1.5 pb-1.5 border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { id: 'total', label: 'Total Clients', value: stats.total, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-white/[0.03]' },
                        { id: 'jobs', label: 'Job Natures', value: stats.jobNaturesCount, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10' },
                        { id: 'sectors', label: 'Sectors', value: stats.sectorsCount, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10' },
                        { id: 'phone', label: 'Contact Numbers', value: stats.hasPhone, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                    ].map((s) => (
                        <div key={s.id} className={`${s.bg} rounded-lg p-2 px-3 border border-gray-100 dark:border-white/5`}>
                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                            <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Toolbar - Search, Sync Status & Actions */}
            <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-200 dark:border-white/5 shrink-0 gap-3">
                <div className="flex items-center gap-3">
                    {/* Manual Save Button & Sync Status */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => saveGridRows()}
                            disabled={isSaving || !hasUnsavedChanges}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                                isSaving
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 cursor-wait'
                                    : hasUnsavedChanges
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-[0.98] cursor-pointer'
                                        : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-white/10'
                            }`}
                            title={hasUnsavedChanges ? 'Click to save all pending changes to the cloud' : 'All changes saved'}
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

                        {hasUnsavedChanges && (
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertCircle size={12} />
                                <span>Unsaved local changes</span>
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {/* Search Input */}
                    <div className="relative w-48">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search company, job, sector..."
                            className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Quick Sector Filter Pills */}
                    {allSectors.length > 0 && (
                        <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 shrink-0">
                            {[{ value: '', label: 'All' }, ...allSectors.slice(0, 4).map(s => ({ value: s.sector_name, label: s.sector_name }))].map(opt => {
                                const isSel = opt.value === '' ? activeFilters.sectors.length === 0 : activeFilters.sectors.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value || 'all'}
                                        onClick={() => {
                                            if (opt.value === '') {
                                                setActiveFilters(prev => ({ ...prev, sectors: [] }));
                                            } else {
                                                setActiveFilters(prev => ({
                                                    ...prev,
                                                    sectors: prev.sectors.includes(opt.value) ? [] : [opt.value]
                                                }));
                                            }
                                        }}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${isSel
                                            ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Filter Dropdown Popup */}
                    <ClientFilterDropdown
                        activeFilters={activeFilters}
                        onApply={(newFilters) => setActiveFilters(newFilters)}
                        availableSectors={allSectors}
                        availableJobNatures={allJobNatures}
                    />

                    {/* Remove Duplicates */}
                    <button
                        onClick={handleRemoveDuplicates}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg text-xs font-semibold transition"
                        title="Instantly find and remove duplicate rows"
                    >
                        <Copy size={13} />
                        <span>Remove Duplicates</span>
                    </button>

                    {/* Export CSV */}
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-800 border border-gray-200 dark:text-gray-400 dark:hover:text-white dark:border-white/10 bg-transparent rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition"
                        title="Export CSV"
                    >
                        <Download size={13} />
                        <span>Export CSV</span>
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={() => fetchClients(true)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10"
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>

                    {/* Add Row Button */}
                    {canWrite && (
                        <div className="relative group">
                            <button
                                onClick={() => handleAddRows(1)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-blue-500/20"
                            >
                                <Plus size={14} />
                                <span>Add Row</span>
                            </button>
                            <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-xl py-1 text-xs w-28 font-semibold">
                                <button onClick={() => handleAddRows(5)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300">Add 5 Rows</button>
                                <button onClick={() => handleAddRows(10)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300">Add 10 Rows</button>
                            </div>
                        </div>
                    )}

                    {/* Manage Dropdown */}
                    {canWrite && (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsManageDropdownOpen(!isManageDropdownOpen)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition"
                            >
                                <span>Manage</span>
                                <ChevronDown size={13} className={`transition-transform duration-200 ${isManageDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isManageDropdownOpen && (
                                <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-[#161b22] rounded-lg shadow-xl border border-gray-200 dark:border-white/10 z-[5000] overflow-hidden py-1 text-xs font-semibold">
                                    <button
                                        onClick={() => { setIsAddModalOpen(true); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <Plus size={14} className="mr-2 text-emerald-500" />
                                        Add Manual Client
                                    </button>
                                    <button
                                        onClick={() => { navigate('/clients/bulk-upload'); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <UploadCloud size={14} className="mr-2 text-blue-500" />
                                        Bulk Upload CSV
                                    </button>
                                    <button
                                        onClick={() => { handleRemoveDuplicates(); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-3 py-2 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-white/5 transition-colors border-t border-gray-100 dark:border-white/5"
                                    >
                                        <Copy size={14} className="mr-2 text-amber-500" />
                                        Remove Duplicates
                                    </button>
                                    <button
                                        onClick={() => { setIsJobNatureModalOpen(true); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border-t border-gray-100 dark:border-white/5 transition-colors"
                                    >
                                        <Briefcase size={14} className="mr-2 text-purple-500" />
                                        Manage Job Natures
                                    </button>
                                    <button
                                        onClick={() => { setIsSectorModalOpen(true); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border-t border-gray-100 dark:border-white/5 transition-colors"
                                    >
                                        <Globe size={14} className="mr-2 text-amber-500" />
                                        Manage Sectors
                                    </button>
                                </div>
                            )}
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

                                {/* Bulk Change Job Nature Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            setShowBulkJobMenu(v => !v);
                                            setShowBulkSectorMenu(false);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition"
                                    >
                                        <span>Change Job Nature</span>
                                        <ChevronDown size={12} />
                                    </button>
                                    {showBulkJobMenu && (
                                        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-xl z-[6000] p-2 text-xs text-gray-800 dark:text-gray-200 flex flex-col max-h-64 overflow-hidden">
                                            <input
                                                type="text"
                                                placeholder="Search job nature..."
                                                className="w-full px-2 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs focus:outline-none mb-1 font-semibold text-gray-900 dark:text-white"
                                                value={bulkJobSearch}
                                                onChange={e => setBulkJobSearch(e.target.value)}
                                            />
                                            <div className="overflow-y-auto no-scrollbar flex-1">
                                                {allJobNatures
                                                    .filter(j => (j.job_name || '').toLowerCase().includes(bulkJobSearch.toLowerCase()))
                                                    .map(j => (
                                                        <button
                                                            key={j.job_id || j.job_name}
                                                            onClick={() => handleBulkChangeJob(j.job_name)}
                                                            className="w-full text-left px-2.5 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-xs font-semibold"
                                                        >
                                                            {j.job_name}
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Bulk Change Sector Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            setShowBulkSectorMenu(v => !v);
                                            setShowBulkJobMenu(false);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition"
                                    >
                                        <span>Change Sector</span>
                                        <ChevronDown size={12} />
                                    </button>
                                    {showBulkSectorMenu && (
                                        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-xl z-[6000] p-2 text-xs text-gray-800 dark:text-gray-200 flex flex-col max-h-64 overflow-hidden">
                                            <input
                                                type="text"
                                                placeholder="Search sector..."
                                                className="w-full px-2 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs focus:outline-none mb-1 font-semibold text-gray-900 dark:text-white"
                                                value={bulkSectorSearch}
                                                onChange={e => setBulkSectorSearch(e.target.value)}
                                            />
                                            <div className="overflow-y-auto no-scrollbar flex-1">
                                                {allSectors
                                                    .filter(s => (s.sector_name || '').toLowerCase().includes(bulkSectorSearch.toLowerCase()))
                                                    .map(s => (
                                                        <button
                                                            key={s.sector_id || s.sector_name}
                                                            onClick={() => handleBulkChangeSector(s.sector_name)}
                                                            className="w-full text-left px-2.5 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-xs font-semibold"
                                                        >
                                                            {s.sector_name}
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

            {/* Main Content Layout */}
            <div ref={tableContainerRef} className="flex-1 min-h-0 flex overflow-hidden w-full relative">
                {/* Spreadsheet Grid Table */}
                <div className="flex-1 min-h-0 overflow-auto no-scrollbar">
                    <table className="w-full min-w-[1500px] text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117] select-none">
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

                                {/* Sortable Columns */}
                                {GRID_COLUMNS.map(colName => (
                                    <th
                                        key={colName}
                                        onClick={() => handleSort(colName)}
                                        className="px-3 py-3 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>
                                                {COLUMN_LABELS[colName]}
                                                {colName === 'name' && <span className="text-red-500 ml-0.5">*</span>}
                                            </span>
                                            {sortConfig.key === colName && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                ))}

                                <th className="px-3 py-3 w-28 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {isLoading && clients.length === 0 ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`skel-row-${i}`} className="animate-pulse">
                                        {Array.from({ length: GRID_COLUMNS.length + 4 }).map((_, j) => (
                                            <td key={`skel-cell-${i}-${j}`} className="px-3 py-3.5 border border-gray-100 dark:border-white/5">
                                                <div className="h-3 bg-gray-100 dark:bg-white/5 rounded"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : sortedGridData.length === 0 ? (
                                <tr>
                                    <td colSpan={GRID_COLUMNS.length + 4} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Building className="text-gray-300 dark:text-white/10" size={44} />
                                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No clients found</p>
                                            <p className="text-xs text-gray-400">
                                                {searchTerm || activeFilters.jobs.length || activeFilters.sectors.length ? 'Adjust your search or filters' : 'Copy rows from Excel and press Ctrl+V to paste instantly'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedGridData.map((client, index) => {
                                    const rowIndex = pageSize === 'All' ? index : (currentPage - 1) * Number(pageSize) + index;
                                    const isNew = client._status === 'new';
                                    const isError = client._status === 'error';
                                    const rowErrors = client._errors || {};
                                    const isRowSelected = selectedIds.has(client.id);

                                    return (
                                        <tr
                                            key={client.id || `row-${rowIndex}`}
                                            className={`hover:bg-blue-50/20 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 ${isRowSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                                                }`}
                                        >
                                            {/* Checkbox Cell */}
                                            <td className="px-3 py-3 text-center border-r border-gray-100 dark:border-white/5 select-none">
                                                <div className="flex justify-center">
                                                    <CustomCheckbox
                                                        checked={isRowSelected}
                                                        onChange={(e) => handleToggleSelectRow(e, client.id)}
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
                                                        title={rowErrors.name || 'Validation error'}
                                                    >
                                                        ERROR
                                                    </span>
                                                )}
                                                {client._status === 'saved' && (
                                                    <span className="text-emerald-500 dark:text-emerald-400/80 text-[10px] font-bold">SAVED</span>
                                                )}
                                            </td>

                                            {/* ─── GRID CELLS ─── */}
                                            {GRID_COLUMNS.map((colName, colIndex) => {
                                                const isInRange = bounds && (
                                                    rowIndex >= bounds.minRow && rowIndex <= bounds.maxRow &&
                                                    colIndex >= bounds.minCol && colIndex <= bounds.maxCol
                                                );
                                                const isTopEdge = bounds && rowIndex === bounds.minRow && colIndex >= bounds.minCol && colIndex <= bounds.maxCol;
                                                const isBottomEdge = bounds && rowIndex === bounds.maxRow && colIndex >= bounds.minCol && colIndex <= bounds.maxCol;
                                                const isLeftEdge = bounds && colIndex === bounds.minCol && rowIndex >= bounds.minRow && rowIndex <= bounds.maxRow;
                                                const isRightEdge = bounds && colIndex === bounds.maxCol && rowIndex >= bounds.minRow && rowIndex <= bounds.maxRow;

                                                const isAnchor = selectionAnchor && selectionAnchor.r === rowIndex && selectionAnchor.c === colIndex;
                                                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colName === colName;

                                                const rawValue = client[colName] || '';

                                                return (
                                                    <td
                                                        key={colName}
                                                        id={`cell-${rowIndex}-${colName}`}
                                                        tabIndex={0}
                                                        onMouseDown={(e) => {
                                                            if (e.target.closest('.z-\\[6000\\]')) return;
                                                            if (!isEditing) {
                                                                e.preventDefault();
                                                                window.getSelection()?.removeAllRanges();
                                                            }
                                                            setIsMouseDown(true);
                                                            if (selectionAnchor?.r !== rowIndex || selectionAnchor?.c !== colIndex || selectionFocus?.r !== rowIndex || selectionFocus?.c !== colIndex) {
                                                                setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                setSelectionFocus({ r: rowIndex, c: colIndex });
                                                            }
                                                        }}
                                                        onMouseEnter={() => {
                                                            if (isMouseDown && (selectionFocus?.r !== rowIndex || selectionFocus?.c !== colIndex)) {
                                                                setSelectionFocus({ r: rowIndex, c: colIndex });
                                                            }
                                                        }}
                                                        onDoubleClick={() => {
                                                            if (canWrite) {
                                                                if (colName === 'job_name' || colName === 'sector_name') {
                                                                    setActiveDropdownCell({ rowIndex, colName });
                                                                } else {
                                                                    setEditingCell({ rowIndex, colName });
                                                                }
                                                            }
                                                        }}
                                                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colName)}
                                                        onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
                                                        className={`px-3 py-2 border-r border-b border-gray-100 dark:border-white/5 relative outline-none select-none ${isInRange ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                                                            } ${isAnchor ? 'ring-2 ring-blue-500/70 z-10' : ''}`}
                                                    >
                                                        {/* Selection Border Overlay */}
                                                        {isInRange && (
                                                            <div className="absolute inset-0 pointer-events-none z-10">
                                                                {isTopEdge && <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />}
                                                                {isBottomEdge && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500" />}
                                                                {isLeftEdge && <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-blue-500" />}
                                                                {isRightEdge && <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-blue-500" />}
                                                            </div>
                                                        )}

                                                        {/* In-Cell Text Editing Input */}
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                value={rawValue}
                                                                onChange={(e) => handleCellChange(rowIndex, colName, e.target.value)}
                                                                onBlur={handleCellBlur}
                                                                onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colName)}
                                                                className="w-full bg-white dark:bg-[#161b22] px-2 py-1 border-2 border-blue-500 rounded text-xs focus:outline-none font-medium text-gray-900 dark:text-white shadow-lg"
                                                            />
                                                        ) : colName === 'job_name' ? (
                                                            /* Nature of Job Dropdown Cell */
                                                            <div className="relative group/cell flex items-center justify-between w-full">
                                                                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                                                    {rawValue || <span className="text-gray-400 dark:text-gray-500 font-normal italic">Select job nature...</span>}
                                                                </span>
                                                                {canWrite && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveDropdownCell(prev => (prev?.rowIndex === rowIndex && prev?.colName === 'job_name') ? null : { rowIndex, colName: 'job_name' });
                                                                        }}
                                                                        className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-400 opacity-60 group-hover/cell:opacity-100 transition-opacity"
                                                                    >
                                                                        <ChevronDown size={12} />
                                                                    </button>
                                                                )}

                                                                {/* Job Nature Popup Menu */}
                                                                {activeDropdownCell?.rowIndex === rowIndex && activeDropdownCell?.colName === 'job_name' && (
                                                                    <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-2xl z-[6000] p-2 flex flex-col max-h-64 overflow-hidden">
                                                                        <input
                                                                            type="text"
                                                                            autoFocus
                                                                            placeholder="Search or enter job nature..."
                                                                            className="w-full px-2 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs focus:outline-none mb-1 font-semibold text-gray-900 dark:text-white"
                                                                            value={jobNatureSearch}
                                                                            onChange={(e) => setJobNatureSearch(e.target.value)}
                                                                        />
                                                                        <div className="overflow-y-auto no-scrollbar flex-1">
                                                                            {allJobNatures
                                                                                .filter(j => (j.job_name || '').toLowerCase().includes(jobNatureSearch.toLowerCase()))
                                                                                .map(j => (
                                                                                    <button
                                                                                        key={j.job_id || j.job_name}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleCellChange(rowIndex, 'job_name', j.job_name, true);
                                                                                            closeDropdown();
                                                                                        }}
                                                                                        className="w-full text-left px-2.5 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-xs font-semibold text-gray-800 dark:text-gray-200"
                                                                                    >
                                                                                        {j.job_name}
                                                                                    </button>
                                                                                ))
                                                                            }
                                                                            {jobNatureSearch.trim() && !allJobNatures.some(j => (j.job_name || '').toLowerCase() === jobNatureSearch.trim().toLowerCase()) && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleCellChange(rowIndex, 'job_name', jobNatureSearch.trim(), true);
                                                                                        closeDropdown();
                                                                                    }}
                                                                                    className="w-full text-left px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-xs font-bold mt-1"
                                                                                >
                                                                                    + Add "{jobNatureSearch.trim()}"
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : colName === 'sector_name' ? (
                                                            /* Sector Dropdown Cell */
                                                            <div className="relative group/cell flex items-center justify-between w-full">
                                                                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                                                    {rawValue || <span className="text-gray-400 dark:text-gray-500 font-normal italic">Select sector...</span>}
                                                                </span>
                                                                {canWrite && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveDropdownCell(prev => (prev?.rowIndex === rowIndex && prev?.colName === 'sector_name') ? null : { rowIndex, colName: 'sector_name' });
                                                                        }}
                                                                        className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-400 opacity-60 group-hover/cell:opacity-100 transition-opacity"
                                                                    >
                                                                        <ChevronDown size={12} />
                                                                    </button>
                                                                )}

                                                                {/* Sector Popup Menu */}
                                                                {activeDropdownCell?.rowIndex === rowIndex && activeDropdownCell?.colName === 'sector_name' && (
                                                                    <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-2xl z-[6000] p-2 flex flex-col max-h-64 overflow-hidden">
                                                                        <input
                                                                            type="text"
                                                                            autoFocus
                                                                            placeholder="Search or enter sector..."
                                                                            className="w-full px-2 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs focus:outline-none mb-1 font-semibold text-gray-900 dark:text-white"
                                                                            value={sectorSearch}
                                                                            onChange={(e) => setSectorSearch(e.target.value)}
                                                                        />
                                                                        <div className="overflow-y-auto no-scrollbar flex-1">
                                                                            {allSectors
                                                                                .filter(s => (s.sector_name || '').toLowerCase().includes(sectorSearch.toLowerCase()))
                                                                                .map(s => (
                                                                                    <button
                                                                                        key={s.sector_id || s.sector_name}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleCellChange(rowIndex, 'sector_name', s.sector_name, true);
                                                                                            closeDropdown();
                                                                                        }}
                                                                                        className="w-full text-left px-2.5 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-xs font-semibold text-gray-800 dark:text-gray-200"
                                                                                    >
                                                                                        {s.sector_name}
                                                                                    </button>
                                                                                ))
                                                                            }
                                                                            {sectorSearch.trim() && !allSectors.some(s => (s.sector_name || '').toLowerCase() === sectorSearch.trim().toLowerCase()) && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleCellChange(rowIndex, 'sector_name', sectorSearch.trim(), true);
                                                                                        closeDropdown();
                                                                                    }}
                                                                                    className="w-full text-left px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-xs font-bold mt-1"
                                                                                >
                                                                                    + Add "{sectorSearch.trim()}"
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            /* Default Text Cell */
                                                            <div className="truncate w-full font-medium">
                                                                {rawValue ? (
                                                                    colName === 'name' ? (
                                                                        <div className="flex items-center justify-between gap-2 w-full">
                                                                            <span className="font-bold text-gray-900 dark:text-white truncate">{rawValue}</span>
                                                                            {renderFollowUpBadge(client.call_on_date || client.follow_up_date)}
                                                                        </div>
                                                                    ) : colName === 'telephone_no' ? (
                                                                        <a
                                                                            href={`tel:${rawValue}`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1.5 truncate"
                                                                            title={`Call ${rawValue}`}
                                                                        >
                                                                            <Phone size={12} className="shrink-0 text-blue-500" />
                                                                            <span className="truncate">{rawValue}</span>
                                                                        </a>
                                                                    ) : colName === 'email' ? (
                                                                        <a
                                                                            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(rawValue)}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1.5 truncate"
                                                                            title={`Open Gmail to email ${rawValue}`}
                                                                        >
                                                                            <Mail size={12} className="shrink-0 text-blue-500" />
                                                                            <span className="truncate">{rawValue}</span>
                                                                        </a>
                                                                    ) : (
                                                                        <span>{rawValue}</span>
                                                                    )
                                                                ) : (
                                                                    <span className="text-gray-300 dark:text-white/10 font-normal hover:text-gray-400">
                                                                        {canWrite ? 'Click to edit' : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* Action Buttons Cell */}
                                            <td className="px-3 py-2 text-center border-b border-gray-100 dark:border-white/5 select-none">
                                                <div className="flex items-center justify-center gap-1 opacity-80 group-hover/row:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleViewClientDetails(client)}
                                                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                                                        title="View Client Details"
                                                    >
                                                        <Info size={15} />
                                                    </button>
                                                    {canWrite && (
                                                        <>
                                                            <button
                                                                onClick={() => handleDuplicateRow(client)}
                                                                className="p-1 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition"
                                                                title="Duplicate Row"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteRow(client)}
                                                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
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

                {/* Client Detail Sidebar */}
                {viewingClient && (
                    <ClientDetails
                        isOpen={!!viewingClient}
                        onClose={() => setViewingClient(null)}
                        client={viewingClient}
                        onEdit={(c) => { setViewingClient(null); setEditingClient(c); setIsAddModalOpen(true); }}
                        onDelete={(id) => { setViewingClient(null); handleDeleteRow({ id, name: viewingClient.name }); }}
                        canWrite={canWrite}
                    />
                )}
            </div>

            {/* High Performance Pagination Footer */}
            {!isLoading && (
                <div className="px-4 py-2 border-t border-gray-200 dark:border-white/5 shrink-0 flex flex-wrap items-center justify-between gap-3 bg-[#f9fafb] dark:bg-[#161b22] text-xs font-medium">
                    <div className="flex items-center gap-3">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Showing <span className="font-bold text-gray-800 dark:text-gray-200">
                                {sortedGridData.length === 0 ? 0 : (pageSize === 'All' ? 1 : (currentPage - 1) * Number(pageSize) + 1)}
                            </span> to <span className="font-bold text-gray-800 dark:text-gray-200">
                                {pageSize === 'All' ? sortedGridData.length : Math.min(currentPage * Number(pageSize), sortedGridData.length)}
                            </span> of <span className="font-bold text-gray-800 dark:text-gray-200">{sortedGridData.length}</span> entries
                            {gridData.length !== sortedGridData.length && (
                                <span className="text-gray-400 font-normal"> (filtered from {gridData.length} total)</span>
                            )}
                        </p>

                        {/* Custom Page Size Dropdown */}
                        <div className="flex items-center gap-1.5 ml-2">
                            <span className="text-[11px] text-gray-400">Rows:</span>
                            <CustomPageSizeDropdown pageSize={pageSize} setPageSize={setPageSize} totalCount={sortedGridData.length} />
                        </div>
                    </div>

                    {/* Page Navigation Controls */}
                    {pageSize !== 'All' && totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-white/5 font-semibold text-[11px]"
                                title="First Page"
                            >
                                « First
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-white/5 font-semibold text-[11px]"
                                title="Previous Page"
                            >
                                ‹ Prev
                            </button>

                            <span className="px-3 text-xs font-bold text-gray-700 dark:text-gray-300">
                                Page {currentPage} of {totalPages}
                            </span>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-white/5 font-semibold text-[11px]"
                                title="Next Page"
                            >
                                Next ›
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-white/5 font-semibold text-[11px]"
                                title="Last Page"
                            >
                                Last »
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Existing Modals */}
            <AddEditClient
                isOpen={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setEditingClient(null); }}
                initialData={editingClient}
                onSave={handleSaveClientFromModal}
                availableSectors={allSectors}
                availableJobNatures={allJobNatures}
            />

            <ManageMetadataModal
                isOpen={isJobNatureModalOpen}
                onClose={() => setIsJobNatureModalOpen(false)}
                title="Manage Job Natures"
                endpoint="/admin/job-natures"
                itemNameKey="job_name"
                itemIdKey="job_id"
                listKey="job_natures"
                addPlaceholder="Enter Job Nature (e.g. Electrical)"
                onUpdate={() => {
                    fetchClients();
                    fetchMetadata();
                }}
            />

            <ManageMetadataModal
                isOpen={isSectorModalOpen}
                onClose={() => setIsSectorModalOpen(false)}
                title="Manage Sectors"
                endpoint="/admin/sectors"
                itemNameKey="sector_name"
                itemIdKey="sector_id"
                listKey="sectors"
                addPlaceholder="Enter Sector (e.g. IT)"
                onUpdate={() => {
                    fetchClients();
                    fetchMetadata();
                }}
            />

            <DuplicateResolverModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                title="Remove Duplicate Clients"
                gridData={gridData}
                getKey={(row) => {
                    const cleanName = (row.name || '').replace(/\s*\(\s*copy(?:\s+\d+)?\s*\)/gi, '').trim().toLowerCase();
                    const email = (row.email || '').trim().toLowerCase();
                    const phone = (row.telephone_no || '').trim().toLowerCase();
                    return cleanName || email || phone;
                }}
                getLabel={(row) => row.name || 'Unnamed Client'}
                getSubLabel={(row) => [row.sector_name, row.job_name, row.email, row.telephone_no].filter(Boolean).join(' • ')}
                onDeleteDuplicates={handleConfirmDeleteDuplicates}
            />

            {/* Right-Click Context Menu Overlay */}
            {contextMenu && (
                <div
                    className="fixed bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[9000] py-1.5 w-56 text-xs select-none backdrop-blur-md"
                    style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {canWrite && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setContextMenu(null);
                                executeCut();
                            }}
                            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold"
                        >
                            <span>Cut</span>
                            <span className="text-[10px] font-mono text-gray-400">Ctrl+X</span>
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu(null);
                            executeCopy();
                        }}
                        className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold"
                    >
                        <span>Copy</span>
                        <span className="text-[10px] font-mono text-gray-400">Ctrl+C</span>
                    </button>
                    {canWrite && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setContextMenu(null);
                                executePaste();
                            }}
                            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold border-b border-gray-100 dark:border-white/5 pb-1.5 mb-1"
                        >
                            <span>Paste</span>
                            <span className="text-[10px] font-mono text-gray-400">Ctrl+V</span>
                        </button>
                    )}

                    {canWrite && ((bounds && bounds.minRow < bounds.maxRow) || selectedIds.size > 1) && (
                        <button
                            onClick={() => {
                                setContextMenu(null);
                                handleFillDown();
                            }}
                            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold"
                        >
                            <span>Fill Down</span>
                            <span className="text-[10px] font-mono text-gray-400">Ctrl+D</span>
                        </button>
                    )}
                    {canWrite && bounds && bounds.minCol < bounds.maxCol && (
                        <button
                            onClick={() => {
                                setContextMenu(null);
                                handleFillRight();
                            }}
                            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold border-b border-gray-100 dark:border-white/5 pb-1.5 mb-1"
                        >
                            <span>Fill Right</span>
                            <span className="text-[10px] font-mono text-gray-400">Ctrl+R</span>
                        </button>
                    )}

                    {canWrite && (
                        <>
                            <button
                                onClick={() => {
                                    setContextMenu(null);
                                    handleInsertRow(contextMenu.rowIndex, 'above');
                                }}
                                className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold"
                            >
                                <span>Insert Row Above</span>
                            </button>
                            <button
                                onClick={() => {
                                    setContextMenu(null);
                                    handleInsertRow(contextMenu.rowIndex, 'below');
                                }}
                                className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold border-b border-gray-100 dark:border-white/5 pb-1.5 mb-1"
                            >
                                <span>Insert Row Below</span>
                            </button>

                            <button
                                onClick={() => {
                                    setContextMenu(null);
                                    const targetRow = sortedGridDataRef.current[contextMenu.rowIndex];
                                    if (targetRow) handleDuplicateRow(targetRow);
                                }}
                                className="w-full text-left px-3.5 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300 flex items-center justify-between font-semibold"
                            >
                                <span>Duplicate Row</span>
                            </button>
                            <button
                                onClick={() => {
                                    setContextMenu(null);
                                    if (selectedIds.size > 0) {
                                        handleBulkDelete();
                                    } else {
                                        const targetRow = sortedGridDataRef.current[contextMenu.rowIndex];
                                        if (targetRow) handleDeleteRow(targetRow);
                                    }
                                }}
                                className="w-full text-left px-3.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-between font-semibold"
                            >
                                <span>Delete {selectedIds.size > 0 ? `Selected (${selectedIds.size})` : 'Row'}</span>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClientsList;
