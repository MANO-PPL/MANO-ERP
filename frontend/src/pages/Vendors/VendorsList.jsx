import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
    Search, Plus, Trash2, Info, RefreshCw, Layers, Users, X, UploadCloud,
    Download, Save, RotateCcw, AlertCircle, ChevronDown, Copy, Eye, CheckSquare,
    Square, ArrowUp, ArrowDown, Filter, Sparkles, Check, Building2, Briefcase, Tag,
    ClipboardPaste, FileSpreadsheet, FileText, CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import vendorApi from '../../services/vendorApi';
import VendorDetails from './VendorDetails';
import VendorFilterDropdown from './VendorFilterDropdown';
import AddEditVendor from './AddEditVendor';
import ManageMetadataModal from '../../components/ManageMetadataModal';
import ConfirmModal from '../../components/ConfirmModal';
import DuplicateResolverModal from '../../components/DuplicateResolverModal';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import SearchableDropdownPortal from '../../components/SearchableDropdownPortal';

const CATEGORY_OPTIONS = [
    'Consultant',
    'Contractor',
    'Supplier',
    'Manufacturer',
    'Service Provider',
    'Other'
];

const parseExcelClipboardText = (text) => {
    if (!text || typeof text !== 'string') return [];
    const cleanText = text.replace(/\r\n$/, '').replace(/\n$/, '').replace(/\r$/, '');
    if (!cleanText) return [];

    const isTabDelimited = cleanText.includes('\t');
    const delimiter = isTabDelimited ? '\t' : (cleanText.includes(',') && !cleanText.includes('\n') ? ',' : '\t');

    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (!insideQuotes && char === delimiter) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if (!insideQuotes && (char === '\n' || (char === '\r' && nextChar === '\n'))) {
            if (char === '\r') i++;
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else if (!insideQuotes && char === '\r') {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    currentRow.push(currentCell.trim());
    rows.push(currentRow);

    return rows.filter(r => r.length > 0 && r.some(c => c !== ''));
};

const resolveVendorCategory = (rawVal) => {
    if (!rawVal) return 'Contractor';
    const clean = rawVal.trim();
    const lower = clean.toLowerCase();
    const matched = CATEGORY_OPTIONS.find(c => c.toLowerCase() === lower);
    if (matched) return matched;
    if (lower.startsWith('contr') || lower === 'sub-contractor' || lower === 'subcontractor') return 'Contractor';
    if (lower.startsWith('supp') || lower === 'vendor') return 'Supplier';
    if (lower.startsWith('consult')) return 'Consultant';
    if (lower.startsWith('manuf')) return 'Manufacturer';
    if (lower.startsWith('serv')) return 'Service Provider';
    if (lower === 'both' || lower === 'all') return 'Contractor';
    return clean;
};

const COLUMN_ALIASES = {
    name: ['company name', 'vendor name', 'vendor', 'firm', 'agency', 'contractor name', 'supplier name', 'organization', 'name', 'party name', 'title'],
    category: ['category', 'vendor category', 'type', 'role', 'classification', 'party category'],
    job_name: ['nature of job', 'job nature', 'scope of work', 'scope', 'trade', 'nature', 'work nature', 'service', 'job'],
    contact_person: ['contact person', 'contact name', 'poc', 'representative', 'person', 'contact'],
    designation: ['designation', 'position', 'title', 'job title', 'role / designation'],
    telephone_no: ['contact no', 'phone no', 'mobile no', 'telephone', 'phone', 'mobile', 'cell', 'contact number', 'telephone no', 'tel'],
    email: ['email id', 'email', 'e-mail', 'mail', 'email address', 'mail id'],
    address: ['address', 'office address', 'site address', 'full address', 'street'],
    location: ['location', 'city', 'state', 'area', 'branch'],
    remarks: ['remarks', 'notes', 'comments', 'description', 'remark', 'note']
};

const matchColumnHeader = (headerText) => {
    if (!headerText || typeof headerText !== 'string') return null;
    const clean = headerText.trim().toLowerCase().replace(/[*_#]/g, '').replace(/\s+/g, ' ');
    for (const [colKey, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (aliases.some(a => clean === a || clean.startsWith(a) || a.startsWith(clean))) {
            return colKey;
        }
    }
    return null;
};

const CATEGORY_BADGE_STYLES = {
    Consultant: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-500/20',
    Contractor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/20',
    Supplier: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500/20',
    Manufacturer: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-500/20',
    'Service Provider': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-500/20',
    Other: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'
};

const downloadExcelTemplateFile = () => {
    const headers = [
        'Company Name',
        'Category',
        'Nature of Job',
        'Contact Person',
        'Designation',
        'Contact No',
        'Email ID',
        'Address',
        'Location',
        'Remarks'
    ];
    const data = [headers];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 30 },
        { wch: 18 },
        { wch: 25 },
        { wch: 22 },
        { wch: 20 },
        { wch: 18 },
        { wch: 28 },
        { wch: 35 },
        { wch: 20 },
        { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    XLSX.writeFile(wb, 'Vendors_Template.xlsx');
};

const GRID_COLUMNS = [
    'name',
    'job_name',
    'contact_person',
    'designation',
    'telephone_no',
    'email',
    'address',
    'category',
    'location',
    'remarks'
];

const COLUMN_LABELS = {
    name: 'Company Name',
    job_name: 'Nature of Job',
    contact_person: 'Contact Person',
    designation: 'Designation',
    telephone_no: 'Contact No',
    email: 'Email ID',
    address: 'Address',
    category: 'Category',
    location: 'Location',
    remarks: 'Remarks'
};

const COLUMN_WIDTH_CLASSES = {
    name: 'w-[220px] min-w-[200px]',
    job_name: 'w-[180px] min-w-[170px]',
    contact_person: 'w-[160px] min-w-[150px]',
    designation: 'w-[150px] min-w-[140px]',
    telephone_no: 'w-[140px] min-w-[140px]',
    email: 'w-[190px] min-w-[180px]',
    address: 'w-[240px] min-w-[220px]',
    category: 'w-[140px] min-w-[140px]',
    location: 'w-[150px] min-w-[140px]',
    remarks: 'w-[200px] min-w-[180px]'
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
                <div className="absolute left-0 bottom-full mb-1 w-36 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-[7000] py-1 text-xs text-gray-700 dark:text-gray-300 font-semibold overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none flex flex-col">
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

const VendorsList = () => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('vendors', 2);

    const tableContainerRef = useRef(null);

    // Helper to load initial state from sessionStorage cache
    const getInitialDraftState = () => {
        try {
            sessionStorage.removeItem('mano_vendors_draft_grid');
            sessionStorage.removeItem('mano_vendors_draft_deleted');
        } catch (e) { }

        let cached = [];
        try {
            const cachedStr = sessionStorage.getItem('mano_vendors_cache');
            if (cachedStr) cached = JSON.parse(cachedStr);
        } catch (e) { }

        return {
            draftGrid: Array.isArray(cached) ? cached.map(v => ({ ...v, _status: 'saved', _errors: {} })) : [],
            draftDeleted: new Set()
        };
    };

    const initialDraft = getInitialDraftState();

    // Metadata & Original list
    const [vendors, setVendors] = useState(() => initialDraft.draftGrid.filter(r => r._status === 'saved'));
    const vendorsRef = useRef(vendors);
    vendorsRef.current = vendors;

    const [allJobNatures, setAllJobNatures] = useState([]);

    // Spreadsheet grid state
    const [gridData, setGridData] = useState(initialDraft.draftGrid);
    const gridDataRef = useRef(gridData);
    gridDataRef.current = gridData;

    // Deleted IDs tracking for manual save
    const [deletedIds, setDeletedIds] = useState(initialDraft.draftDeleted);
    const deletedIdsRef = useRef(deletedIds);
    deletedIdsRef.current = deletedIds;

    // Original database data map for dirty comparison
    const originalVendorsMap = useMemo(() => {
        const map = new Map();
        vendors.forEach(v => {
            if (v && v.id) map.set(v.id, v);
        });
        return map;
    }, [vendors]);

    // Check if a row differs from its original database record
    const isVendorRowDirty = (row, originalVendor) => {
        if (!row) return false;
        if (!originalVendor) {
            // New row: dirty if marked as new and user has entered non-empty data
            return row._status === 'new' && Boolean(row.name && row.name.trim());
        }
        if (row._status === 'new') {
            return Boolean(row.name && row.name.trim());
        }
        return GRID_COLUMNS.some(col => {
            const curVal = String(row[col] ?? '').trim();
            const origVal = String(originalVendor[col] ?? '').trim();
            return curVal !== origVal;
        });
    };

    const { hasUnsavedChanges, unsavedCount } = useMemo(() => {
        if (deletedIds.size === 0 && gridData.length === vendors.length && gridData.every(r => r._status === 'saved')) {
            return { hasUnsavedChanges: false, unsavedCount: 0 };
        }
        let dirtyCount = 0;
        for (let i = 0; i < gridData.length; i++) {
            const row = gridData[i];
            if (row._status === 'new') {
                if (row.name && row.name.trim()) dirtyCount++;
            } else if (row._status === 'modified' || row._status === 'error') {
                const original = originalVendorsMap.get(row.id);
                if (isVendorRowDirty(row, original)) dirtyCount++;
            }
        }
        const total = dirtyCount + deletedIds.size;
        return { hasUnsavedChanges: total > 0, unsavedCount: total };
    }, [gridData, originalVendorsMap, deletedIds, vendors.length]);

    // Undo / Redo Stacks
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const cellEditInitialStateRef = useRef(null);

    const pushUndoState = (gridSnapshot) => {
        if (!gridSnapshot) return;
        const snapshotCopy = gridSnapshot.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
        undoStackRef.current.push(snapshotCopy);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
    };

    const [isLoading, setIsLoading] = useState(initialDraft.draftGrid.length === 0);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState(null);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilters, setActiveFilters] = useState({ jobs: [], categories: [] });
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [filterJobSearch, setFilterJobSearch] = useState('');
    const filterDropdownRef = useRef(null);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [isJobNatureModalOpen, setIsJobNatureModalOpen] = useState(false);
    const [isManageDropdownOpen, setIsManageDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Excel Tools & Right Sidebar Drawer State
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [isExcelDropdownOpen, setIsExcelDropdownOpen] = useState(false);
    const excelDropdownRef = useRef(null);
    const fileInputRef = useRef(null);
    const [excelPasteText, setExcelPasteText] = useState('');
    const [excelParsedVendors, setExcelParsedVendors] = useState([]);
    const [excelSourceFileName, setExcelSourceFileName] = useState('');
    const [excelImportMode, setExcelImportMode] = useState('append'); // 'append' | 'replace'
    const [excelModalTab, setExcelModalTab] = useState('upload'); // 'upload' | 'paste'

    // Selection & Bulk State
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [lastSelectedId, setLastSelectedId] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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
    const [viewingVendor, setViewingVendor] = useState(null);

    // Excel Cell Range Selection & Editing State
    const [selectionAnchor, setSelectionAnchor] = useState(null);
    const [selectionFocus, setSelectionFocus] = useState(null);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [editingCell, setEditingCell] = useState(null);

    // Refs for always-fresh access in event callbacks (avoids stale closures)
    const selectionAnchorRef = useRef(null);
    selectionAnchorRef.current = selectionAnchor;
    const selectionFocusRef = useRef(null);
    selectionFocusRef.current = selectionFocus;
    const selectedIdsRef = useRef(new Set());
    selectedIdsRef.current = selectedIds;

    // Internal clipboard buffer for cut/copy/paste between cells
    const internalClipboardRef = useRef('');

    // Always-fresh ref to executePaste — avoids stale closure in useEffect event handlers
    const executePasteRef = useRef(null);

    // Compute selection bounds from refs (safe to call inside any event handler)
    const getBoundsFromRefs = () => {
        const anchor = selectionAnchorRef.current;
        if (!anchor) return null;
        const focus = selectionFocusRef.current || anchor;
        return {
            minRow: Math.min(anchor.r, focus.r),
            maxRow: Math.max(anchor.r, focus.r),
            minCol: Math.min(anchor.c, focus.c),
            maxCol: Math.max(anchor.c, focus.c),
        };
    };

    // Helper to get target index right below current cursor/selection
    const getTargetInsertIndex = () => {
        const bounds = getBoundsFromRefs();
        const anchor = selectionAnchorRef.current;
        let activeSortedRowIdx = -1;
        if (bounds) {
            activeSortedRowIdx = bounds.maxRow;
        } else if (anchor) {
            activeSortedRowIdx = anchor.r;
        }

        if (activeSortedRowIdx >= 0 && sortedGridDataRef.current[activeSortedRowIdx]) {
            const targetRowId = sortedGridDataRef.current[activeSortedRowIdx].id;
            const realIdx = gridDataRef.current.findIndex(r => r.id === targetRowId);
            if (realIdx !== -1) {
                return { gridInsertIdx: realIdx + 1, sortedRowIdx: activeSortedRowIdx + 1 };
            }
        }

        return { gridInsertIdx: gridDataRef.current.length, sortedRowIdx: sortedGridDataRef.current.length };
    };

    // Custom In-Table Dropdowns State
    const [activeDropdownCell, setActiveDropdownCell] = useState(null);
    const [jobNatureSearch, setJobNatureSearch] = useState('');
    const [dropdownPortalProps, setDropdownPortalProps] = useState(null); // { top, left, rowIndex, colName }

    // Bulk Change Menus State
    const [showBulkJobMenu, setShowBulkJobMenu] = useState(false);
    const [showBulkCategoryMenu, setShowBulkCategoryMenu] = useState(false);
    const [bulkJobSearch, setBulkJobSearch] = useState('');
    const [contextMenu, setContextMenu] = useState(null);

    const closeDropdown = () => {
        setActiveDropdownCell(null);
        setJobNatureSearch('');
        setShowBulkJobMenu(false);
        setShowBulkCategoryMenu(false);
        setBulkJobSearch('');
        setContextMenu(null);
        setDropdownPortalProps(null);
    };

    useEffect(() => {
        const handleCloseMenu = () => setContextMenu(null);
        window.addEventListener('click', handleCloseMenu);
        return () => window.removeEventListener('click', handleCloseMenu);
    }, []);

    const handleContextMenu = (e, rowIndex, colIndex) => {
        e.preventDefault();
        e.stopPropagation();

        const curBounds = getBoundsFromRefs();
        const isInRange = curBounds &&
            rowIndex >= curBounds.minRow && rowIndex <= curBounds.maxRow &&
            colIndex >= curBounds.minCol && colIndex <= curBounds.maxCol;

        if (!isInRange) {
            selectionAnchorRef.current = { r: rowIndex, c: colIndex };
            selectionFocusRef.current = { r: rowIndex, c: colIndex };
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
        const bounds = getBoundsFromRefs();
        if (!bounds || bounds.minRow === bounds.maxRow || !canWrite) return;
        pushUndoState(gridDataRef.current);

        let updatedGrid = [...gridDataRef.current];

        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
            const colName = GRID_COLUMNS[c];
            const topRowObj = sortedGridDataRef.current[bounds.minRow];
            if (!topRowObj) continue;
            const topVal = topRowObj[colName];

            for (let r = bounds.minRow + 1; r <= bounds.maxRow; r++) {
                const targetRowObj = sortedGridDataRef.current[r];
                if (!targetRowObj) continue;
                const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
                if (realIdx === -1) continue;

                const rowCopy = { ...updatedGrid[realIdx], [colName]: topVal };
                if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                updatedGrid[realIdx] = rowCopy;
            }
        }

        setGridData(updatedGrid);
        showToast('sparkle', 'Fill Down (Ctrl+D)', `Filled values down across ${bounds.maxRow - bounds.minRow + 1} rows.`);
    };

    const handleFillRight = () => {
        const bounds = getBoundsFromRefs();
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
        const targetRow = sortedGridDataRef.current[targetRowIndex];
        let realIdx = targetRowIndex;
        if (targetRow) {
            const found = gridDataRef.current.findIndex(r => r.id === targetRow.id);
            if (found !== -1) realIdx = found;
        }
        const insertIdx = position === 'above' ? realIdx : realIdx + 1;
        const newRow = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: '',
            job_name: '',
            contact_person: '',
            designation: '',
            telephone_no: '',
            email: '',
            address: '',
            category: 'Contractor',
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
        let rowsToCopy = [];
        let minCol = 0;
        let maxCol = GRID_COLUMNS.length - 1;

        const curSelectedIds = selectedIdsRef.current;
        const bounds = getBoundsFromRefs();

        if (curSelectedIds.size > 0) {
            rowsToCopy = sortedGridDataRef.current.filter(r => curSelectedIds.has(r.id));
        } else if (bounds) {
            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                if (sortedGridDataRef.current[r]) rowsToCopy.push(sortedGridDataRef.current[r]);
            }
            minCol = bounds.minCol;
            maxCol = bounds.maxCol;
        }

        if (rowsToCopy.length === 0) return;

        const tsvLines = rowsToCopy.map(rowObj => {
            const rowVals = [];
            for (let c = minCol; c <= maxCol; c++) {
                const colName = GRID_COLUMNS[c];
                rowVals.push(rowObj[colName] ?? '');
            }
            return rowVals.join('\t');
        });

        const tsvData = tsvLines.join('\n');
        if (tsvData.trim()) {
            internalClipboardRef.current = tsvData;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(tsvData).catch(err => console.warn(err));
            }
            const numCells = tsvLines.length * (maxCol - minCol + 1);
            showToast('sparkle', '', numCells === 1 ? 'Copied 1 cell to clipboard' : `Copied ${numCells} cells to clipboard`);
        }
    };

    const executeCut = () => {
        if (!canWrite) return;
        executeCopy();
        pushUndoState(gridDataRef.current);
        const curSelectedIds = selectedIdsRef.current;
        const bounds = getBoundsFromRefs();

        if (curSelectedIds.size > 0) {
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
            showToast('sparkle', '', numCleared === 1 ? 'Cut 1 cell to clipboard' : `Cut ${numCleared} cells to clipboard`);
        }
    };

    // Auto-Fill Down (Double-Click Fill Handle)
    const handleAutoFillDown = () => {
        const bounds = getBoundsFromRefs();
        if (!bounds || !canWrite) return;
        const totalRows = sortedGridDataRef.current.length;
        if (bounds.maxRow >= totalRows - 1) return;

        pushUndoState(gridDataRef.current);
        let updatedGrid = [...gridDataRef.current];
        const sourceRowObj = sortedGridDataRef.current[bounds.maxRow];
        if (!sourceRowObj) return;

        for (let r = bounds.maxRow + 1; r < totalRows; r++) {
            const targetRowObj = sortedGridDataRef.current[r];
            if (!targetRowObj) continue;
            const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
            if (realIdx === -1) continue;

            const rowCopy = { ...updatedGrid[realIdx] };
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const colName = GRID_COLUMNS[c];
                rowCopy[colName] = sourceRowObj[colName] ?? '';
            }
            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
            updatedGrid[realIdx] = rowCopy;
        }

        setGridData(updatedGrid);
        setSelectionFocus({ r: totalRows - 1, c: bounds.maxCol });
        showToast('sparkle', 'Auto-Fill Down', `Auto-filled values down to bottom of table (${totalRows} rows).`);
    };

    const parseRawRowsToVendors = (rawRows, defaultCategory = 'Contractor') => {
        if (!rawRows || rawRows.length === 0) return [];
        let parsedList = [];

        if (Array.isArray(rawRows[0])) {
            let headerRowIdx = -1;
            let colMap = {};

            for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
                const row = rawRows[i];
                let matches = 0;
                const tempMap = {};
                row.forEach((cell, cIdx) => {
                    const matched = matchColumnHeader(String(cell || ''));
                    if (matched) {
                        tempMap[cIdx] = matched;
                        matches++;
                    }
                });
                if (matches >= 2 || (row.length === 1 && matches === 1)) {
                    headerRowIdx = i;
                    colMap = tempMap;
                    break;
                }
            }

            const dataRows = headerRowIdx !== -1 ? rawRows.slice(headerRowIdx + 1) : rawRows;

            dataRows.forEach((row, rIdx) => {
                if (!row || !row.some(c => String(c || '').trim() !== '')) return;

                const item = {
                    id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${rIdx}`,
                    name: '',
                    category: defaultCategory || 'Contractor',
                    job_name: '',
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

                row.forEach((cellVal, cIdx) => {
                    const val = String(cellVal ?? '').trim();
                    const targetCol = headerRowIdx !== -1 ? colMap[cIdx] : GRID_COLUMNS[cIdx];
                    if (targetCol && GRID_COLUMNS.includes(targetCol)) {
                        if (targetCol === 'category') {
                            item.category = resolveVendorCategory(val);
                        } else if (targetCol === 'job_name') {
                            const matchedJob = allJobNatures.find(j =>
                                (j.job_name || '').toLowerCase() === val.toLowerCase()
                            );
                            item.job_name = matchedJob ? matchedJob.job_name : val;
                        } else {
                            item[targetCol] = val;
                        }
                    }
                });

                if (!item.name) {
                    const firstNonEmpty = row.find(c => String(c || '').trim() !== '');
                    if (firstNonEmpty) item.name = String(firstNonEmpty).trim();
                }

                if (item.name) {
                    parsedList.push(item);
                }
            });
        } else {
            rawRows.forEach((r, rIdx) => {
                const item = {
                    id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${rIdx}`,
                    name: '',
                    category: defaultCategory || 'Contractor',
                    job_name: '',
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

                Object.entries(r).forEach(([key, val]) => {
                    const cleanVal = String(val ?? '').trim();
                    const targetCol = matchColumnHeader(key) || (GRID_COLUMNS.includes(key) ? key : null);
                    if (targetCol && GRID_COLUMNS.includes(targetCol)) {
                        if (targetCol === 'category') {
                            item.category = resolveVendorCategory(cleanVal);
                        } else if (targetCol === 'job_name') {
                            const matchedJob = allJobNatures.find(j =>
                                (j.job_name || '').toLowerCase() === cleanVal.toLowerCase()
                            );
                            item.job_name = matchedJob ? matchedJob.job_name : cleanVal;
                        } else {
                            item[targetCol] = cleanVal;
                        }
                    }
                });

                if (!item.name) {
                    const fallbackName = r['Company Name'] || r['Vendor Name'] || r['Company'] || r['name'] || r['Name'] || '';
                    if (fallbackName) item.name = String(fallbackName).trim();
                }

                if (item.name) {
                    parsedList.push(item);
                }
            });
        }

        return parsedList;
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setExcelSourceFileName(file.name);
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    let targetSheetName = workbook.SheetNames[0];
                    for (const name of workbook.SheetNames) {
                        const sheet = workbook.Sheets[name];
                        if (sheet && sheet['!ref']) {
                            targetSheetName = name;
                            break;
                        }
                    }

                    const sheet = workbook.Sheets[targetSheetName];
                    const rawAoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    const parsed = parseRawRowsToVendors(rawAoa);
                    setExcelParsedVendors(parsed);
                    setExcelModalTab('upload');
                    setIsExcelModalOpen(true);
                } catch (err) {
                    console.error('Failed to parse Excel file:', err);
                    showToast('error', 'Import Failed', 'Failed to read Excel spreadsheet data. Please check the file.');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            Papa.parse(file, {
                skipEmptyLines: true,
                complete: (results) => {
                    if (!results.data || results.data.length === 0) {
                        showToast('error', 'Import Failed', 'Uploaded CSV contains no valid data.');
                        return;
                    }
                    const parsed = parseRawRowsToVendors(results.data);
                    setExcelParsedVendors(parsed);
                    setExcelModalTab('upload');
                    setIsExcelModalOpen(true);
                },
                error: (err) => {
                    console.error('Failed to parse CSV file:', err);
                    showToast('error', 'Import Failed', 'Failed to read CSV spreadsheet data.');
                }
            });
        }
        e.target.value = '';
    };

    const handleCommitExcelImport = () => {
        if (!excelParsedVendors || excelParsedVendors.length === 0) {
            showToast('info', 'No Rows', 'No valid vendor rows to import.');
            return;
        }

        pushUndoState(gridDataRef.current);

        if (excelImportMode === 'append') {
            setGridData(prev => [...excelParsedVendors, ...prev]);
        } else {
            setGridData(excelParsedVendors);
        }

        setIsExcelModalOpen(false);
        setExcelParsedVendors([]);
        setExcelPasteText('');
        showToast('sparkle', 'Vendors Imported', `Successfully imported ${excelParsedVendors.length} vendor row(s). Click "Save Changes" to save to database.`);
    };

    const executePaste = (pastedText, forcedStartRow, forcedStartCol) => {
        const textToPaste = pastedText || internalClipboardRef.current;
        if (!textToPaste || !textToPaste.trim()) {
            showToast('info', '', 'Clipboard is empty');
            return;
        }

        const parsedRows = parseExcelClipboardText(textToPaste);
        if (parsedRows.length === 0) return;

        // Check if top row is header row
        if (parsedRows.length > 1 && forcedStartRow === undefined) {
            let headerMatches = 0;
            parsedRows[0].forEach(cell => {
                if (matchColumnHeader(String(cell || ''))) headerMatches++;
            });
            if (headerMatches >= 2) {
                const parsedVendors = parseRawRowsToVendors(parsedRows);
                if (parsedVendors.length > 0) {
                    pushUndoState(gridDataRef.current);
                    setGridData(prev => [...parsedVendors, ...prev]);
                    showToast('sparkle', 'Pasted Vendors', `Mapped & added ${parsedVendors.length} vendor row(s) from Excel.`);
                    return;
                }
            }
        }

        pushUndoState(gridDataRef.current);

        let startRow = 0;
        let startCol = 0;

        const curSelectedIds = selectedIdsRef.current;
        const bounds = getBoundsFromRefs();

        if (forcedStartRow !== undefined && forcedStartCol !== undefined) {
            startRow = forcedStartRow;
            startCol = forcedStartCol;
        } else if (curSelectedIds.size > 0) {
            const firstSelectedId = Array.from(curSelectedIds)[0];
            const foundIdx = sortedGridDataRef.current.findIndex(r => r.id === firstSelectedId);
            if (foundIdx !== -1) startRow = foundIdx;
            startCol = bounds ? bounds.minCol : 0;
        } else if (bounds) {
            startRow = bounds.minRow;
            startCol = bounds.minCol;
        } else if (selectionAnchorRef.current) {
            startRow = selectionAnchorRef.current.r;
            startCol = selectionAnchorRef.current.c;
        }

        // Smart Excel Range Replication
        let expandedRows = parsedRows;
        if (bounds && (bounds.maxRow > bounds.minRow || bounds.maxCol > bounds.minCol) && forcedStartRow === undefined) {
            const targetRowCount = bounds.maxRow - bounds.minRow + 1;
            const targetColCount = bounds.maxCol - bounds.minCol + 1;

            if (parsedRows.length === 1 && parsedRows[0].length === 1) {
                const singleVal = parsedRows[0][0];
                expandedRows = Array.from({ length: targetRowCount }, () =>
                    Array.from({ length: targetColCount }, () => singleVal)
                );
            } else if (parsedRows.length === 1 && targetRowCount > 1) {
                expandedRows = Array.from({ length: targetRowCount }, () => [...parsedRows[0]]);
            } else if (parsedRows[0].length === 1 && targetColCount > 1) {
                expandedRows = parsedRows.map(row => Array.from({ length: targetColCount }, () => row[0]));
            }
        }

        let updatedGrid = [...gridDataRef.current];
        let numCellsUpdated = 0;
        let newRowsAddedCount = 0;

        expandedRows.forEach((cells, dr) => {
            const r = startRow + dr;
            const targetRowObj = sortedGridDataRef.current[r];

            if (targetRowObj) {
                const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
                if (realIdx !== -1) {
                    const rowCopy = { ...updatedGrid[realIdx] };
                    cells.forEach((cellVal, dc) => {
                        const c = startCol + dc;
                        if (c < GRID_COLUMNS.length) {
                            const colName = GRID_COLUMNS[c];
                            let valToAssign = (cellVal ?? '').trim();
                            if (colName === 'category') {
                                valToAssign = resolveVendorCategory(valToAssign);
                            } else if (colName === 'job_name') {
                                const matchedJob = allJobNatures.find(j =>
                                    (j.job_name || '').toLowerCase() === valToAssign.toLowerCase()
                                );
                                if (matchedJob) valToAssign = matchedJob.job_name;
                            }
                            rowCopy[colName] = valToAssign;
                            numCellsUpdated++;
                        }
                    });
                    if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                    if (rowCopy._errors?.name && rowCopy.name?.trim()) {
                        delete rowCopy._errors.name;
                    }
                    updatedGrid[realIdx] = rowCopy;
                }
            } else {
                const newRow = {
                    id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${dr}`,
                    name: '',
                    job_name: '',
                    contact_person: '',
                    designation: '',
                    telephone_no: '',
                    email: '',
                    address: '',
                    category: 'Contractor',
                    location: '',
                    remarks: '',
                    _status: 'new',
                    _errors: {}
                };
                cells.forEach((cellVal, dc) => {
                    const c = startCol + dc;
                    if (c < GRID_COLUMNS.length) {
                        const colName = GRID_COLUMNS[c];
                        let valToAssign = (cellVal ?? '').trim();
                        if (colName === 'category') {
                            valToAssign = resolveVendorCategory(valToAssign);
                        } else if (colName === 'job_name') {
                            const matchedJob = allJobNatures.find(j =>
                                (j.job_name || '').toLowerCase() === valToAssign.toLowerCase()
                            );
                            if (matchedJob) valToAssign = matchedJob.job_name;
                        }
                        newRow[colName] = valToAssign;
                        numCellsUpdated++;
                    }
                });
                if (!newRow.name) {
                    const nonVal = cells.find(c => c && c.trim());
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

            const endRow = Math.min(startRow + expandedRows.length - 1, (sortedGridDataRef.current.length + newRowsAddedCount) - 1);
            const endCol = Math.min(startCol + (expandedRows[0]?.length || 1) - 1, GRID_COLUMNS.length - 1);
            setSelectionAnchor({ r: startRow, c: startCol });
            setSelectionFocus({ r: endRow, c: endCol });

            if (newRowsAddedCount > 0) {
                showToast('sparkle', '', `Pasted ${numCellsUpdated} cell${numCellsUpdated > 1 ? 's' : ''} (${newRowsAddedCount} new row${newRowsAddedCount > 1 ? 's' : ''})`);
            } else {
                showToast('sparkle', '', numCellsUpdated === 1 ? 'Pasted 1 cell successfully' : `Pasted ${numCellsUpdated} cells successfully`);
            }
        }
    };
    // Keep the ref up to date every render so event handlers always call latest version
    executePasteRef.current = executePaste;


    // Global MouseUp for range drag selection
    useEffect(() => {
        const handleGlobalMouseUp = () => setIsMouseDown(false);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // Global click outside & keydown listener
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (e.target.closest('.z-\\[6000\\]') || e.target.closest('.z-\\[9999\\]') || e.target.closest('.z-\\[9000\\]') || e.target.closest('[data-context-menu="true"]') || e.target.closest('[role="dialog"]')) {
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
        total: vendors.length,
        jobNaturesCount: allJobNatures.length,
        categoriesCount: CATEGORY_OPTIONS.length,
        hasPhone: vendors.reduce((acc, v) => (v.telephone_no || v.mobile ? acc + 1 : acc), 0)
    }), [vendors, allJobNatures]);

    const filteredJobNaturesInCell = useMemo(() => {
        if (!jobNatureSearch) return allJobNatures.slice(0, 5);
        const lower = jobNatureSearch.toLowerCase();
        return allJobNatures.filter(j => (j.job_name || '').toLowerCase().includes(lower)).slice(0, 5);
    }, [allJobNatures, jobNatureSearch]);

    const fetchMetadata = async () => {
        try {
            const res = await api.get('/admin/job-natures');
            if (res.data.success) {
                const natures = res.data.job_natures || [];
                console.log('[VendorsList] Loaded', natures.length, 'job natures');
                setAllJobNatures(natures);
            }
        } catch (err) {
            console.error('Failed to fetch job nature metadata:', err);
        }
    };

    const fetchVendors = async (isManualRefresh = false) => {
        if (vendorsRef.current.length === 0) {
            setIsLoading(true);
        }
        try {
            const params = { limit: 50000 };
            const resData = await vendorApi.getVendors(params);
            const fetchedList = resData.vendors || [];

            try {
                sessionStorage.setItem('mano_vendors_cache', JSON.stringify(fetchedList));
            } catch (e) { }

            setVendors(fetchedList);

            setGridData(prevGrid => {
                const newUnsaved = prevGrid.filter(r => r._status === 'new' || String(r.id).startsWith('temp_'));
                const modifiedMap = new Map(
                    prevGrid.filter(r => r._status === 'modified' || r._status === 'error').map(r => [r.id, r])
                );
                const curDeletedIds = deletedIdsRef.current;

                const updatedGrid = fetchedList
                    .filter(fetched => !curDeletedIds.has(fetched.id))
                    .map(fetched => {
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
                showToast('info', 'Refreshed', 'Vendor list updated from server.');
            }
        } catch (error) {
            console.error('Failed to fetch vendors', error);
            showToast('error', 'Fetch Error', error.response?.data?.message || 'Failed to load vendors', 5000);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMetadata();
        fetchVendors();
    }, []);

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsManageDropdownOpen(false);
            }
            if (excelDropdownRef.current && !excelDropdownRef.current.contains(event.target)) {
                setIsExcelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─── Manual Batch Save Engine ──────────────────────────────────────────────
    const saveGridRows = async () => {
        const targetGrid = gridDataRef.current;
        const dirtyRows = targetGrid.filter(r => {
            const original = originalVendorsMap.get(r.id);
            return isVendorRowDirty(r, original);
        });
        const newRows = dirtyRows.filter(r => (!originalVendorsMap.has(r.id) || r._status === 'new') && r.name && r.name.trim());
        const modifiedRows = dirtyRows.filter(r => originalVendorsMap.has(r.id) && r._status !== 'new' && r.name && r.name.trim());
        const pendingDeleteIds = Array.from(deletedIds);

        if (newRows.length === 0 && modifiedRows.length === 0 && pendingDeleteIds.length === 0) {
            showToast('info', 'No Changes', 'There are no unsaved changes to save.');
            return;
        }

        setIsSaving(true);
        try {
            if (pendingDeleteIds.length > 0) {
                await vendorApi.deleteVendors(pendingDeleteIds);
                setDeletedIds(new Set());
            }

            const savedVendorIds = new Set(vendorsRef.current.map(v => v.id));
            const validModifiedRows = [];
            const newPayloadRows = [...newRows];

            modifiedRows.forEach(r => {
                if (savedVendorIds.has(r.id)) {
                    validModifiedRows.push(r);
                } else {
                    newPayloadRows.push(r);
                }
            });

            const createdResults = [];
            if (newPayloadRows.length > 0) {
                for (const row of newPayloadRows) {
                    const { id, _status, _errors, ...payload } = row;
                    const res = await vendorApi.createVendor(payload);
                    if (res && res.id) {
                        createdResults.push({ tempId: id, realId: res.id, ...payload });
                    }
                }
            }

            if (validModifiedRows.length > 0) {
                for (const row of validModifiedRows) {
                    const { id, _status, _errors, ...payload } = row;
                    await vendorApi.updateVendor(id, payload);
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

            setVendors(prev => {
                const updated = prev.filter(v => !pendingDeleteIds.includes(v.id));
                validModifiedRows.forEach(mod => {
                    const idx = updated.findIndex(v => v.id === mod.id);
                    if (idx !== -1) updated[idx] = { ...updated[idx], ...mod, _status: 'saved' };
                });
                createdResults.forEach(c => {
                    if (!updated.some(v => v.id === c.realId)) {
                        updated.push({ id: c.realId, ...c, _status: 'saved' });
                    }
                });
                return updated;
            });

            try {
                sessionStorage.removeItem('mano_vendors_draft_grid');
                sessionStorage.removeItem('mano_vendors_draft_deleted');
            } catch (e) { }

            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setLastSavedTime(timeStr);
            showToast('success', 'Changes Saved', 'All changes have been successfully saved to database & cloud.');
        } catch (err) {
            console.error('Failed to save vendor grid', err);
            showToast('error', 'Save Error', err.response?.data?.message || 'Failed to save vendor changes', 5000);
        } finally {
            setIsSaving(false);
        }
    };

    // Filter & Sort Grid Data (High-performance fast execution)
    const filteredGridData = useMemo(() => {
        const hasJobs = activeFilters.jobs.length > 0;
        const hasCats = activeFilters.categories.length > 0;
        const hasSearch = Boolean(searchTerm && searchTerm.trim());

        if (!hasSearch && !hasJobs && !hasCats) {
            return gridData;
        }

        const lowerSearch = hasSearch ? searchTerm.toLowerCase().trim() : '';
        const jobSet = hasJobs ? new Set(activeFilters.jobs) : null;
        const catSet = hasCats ? new Set(activeFilters.categories.map(c => c.toLowerCase())) : null;

        return gridData.filter(r => {
            if (jobSet && !jobSet.has(r.job_name)) return false;
            if (catSet) {
                const rowCat = (r.category || '').toLowerCase();
                const matched = catSet.has(rowCat) ||
                    ((rowCat === 'consultant' || rowCat === 'consultants') && (catSet.has('consultant') || catSet.has('consultants')));
                if (!matched) return false;
            }
            if (lowerSearch) {
                const name = r.name ? r.name.toLowerCase() : '';
                const job = r.job_name ? r.job_name.toLowerCase() : '';
                const cat = r.category ? r.category.toLowerCase() : '';
                const contact = r.contact_person ? r.contact_person.toLowerCase() : '';
                const phone = r.telephone_no ? r.telephone_no.toLowerCase() : '';
                const email = r.email ? r.email.toLowerCase() : '';
                const addr = r.address ? r.address.toLowerCase() : '';

                return name.includes(lowerSearch) ||
                    job.includes(lowerSearch) ||
                    cat.includes(lowerSearch) ||
                    contact.includes(lowerSearch) ||
                    phone.includes(lowerSearch) ||
                    email.includes(lowerSearch) ||
                    addr.includes(lowerSearch);
            }
            return true;
        });
    }, [gridData, searchTerm, activeFilters]);

    const sortedGridData = useMemo(() => {
        const savedRows = [];
        const newRows = [];

        for (const row of filteredGridData) {
            if (row._status === 'new' || String(row.id).startsWith('temp_')) {
                newRows.push(row);
            } else {
                savedRows.push(row);
            }
        }

        if (sortConfig.key && savedRows.length > 1) {
            const key = sortConfig.key;
            const isAsc = sortConfig.direction === 'asc';

            savedRows.sort((a, b) => {
                const aVal = a[key];
                const bVal = b[key];
                if (aVal === bVal) return 0;
                if (aVal == null || aVal === '') return 1;
                if (bVal == null || bVal === '') return -1;

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return isAsc ? aVal - bVal : bVal - aVal;
                }

                const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
                return isAsc ? cmp : -cmp;
            });
        }

        return [...savedRows, ...newRows];
    }, [filteredGridData, sortConfig]);

    const sortedGridDataRef = useRef(sortedGridData);
    sortedGridDataRef.current = sortedGridData;

    // Pagination States & Memoization
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50); // Options: 50, 100, 250, 500, 1000, 'All'

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
    const handleCancelChanges = () => {
        if (!hasUnsavedChanges) return;
        setConfirmModal({
            isOpen: true,
            title: 'Cancel & Discard Unsaved Changes?',
            message: `Are you sure you want to discard all ${unsavedCount} unsaved change(s)? This will revert your table back to the saved state.`,
            confirmText: 'Discard Changes',
            cancelText: 'Keep Editing',
            variant: 'warning',
            isLoading: false,
            onConfirm: () => {
                pushUndoState(gridDataRef.current);
                try {
                    sessionStorage.removeItem('mano_vendors_draft_grid');
                    sessionStorage.removeItem('mano_vendors_draft_deleted');
                } catch (e) { }

                const savedList = vendorsRef.current.map(v => ({ ...v, _status: 'saved', _errors: {} }));
                setGridData(savedList);
                setDeletedIds(new Set());
                setSelectionAnchor(null);
                setSelectionFocus(null);
                setEditingCell(null);
                closeConfirmModal();
                showToast('info', 'Changes Cancelled', 'All unsaved local changes have been discarded.');
            }
        });
    };

    const executeDuplicate = () => {
        if (!canWrite) return;

        const curSelectedIds = selectedIdsRef.current;
        if (curSelectedIds.size > 0) {
            handleBulkDuplicate();
            return;
        }

        const bounds = getBoundsFromRefs();
        if (!bounds) return;

        pushUndoState(gridDataRef.current);

        const totalCols = GRID_COLUMNS.length;
        const isFullRowSelected = (bounds.minCol === 0 && bounds.maxCol === totalCols - 1);

        if (isFullRowSelected) {
            // Duplicate entire selected row(s) right below the selection
            const rowsToDuplicate = [];
            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                const targetRowObj = sortedGridDataRef.current[r];
                if (targetRowObj) rowsToDuplicate.push(targetRowObj);
            }

            if (rowsToDuplicate.length > 0) {
                const lastRowObj = rowsToDuplicate[rowsToDuplicate.length - 1];
                let insertIdx = gridDataRef.current.length;
                if (lastRowObj) {
                    const foundIdx = gridDataRef.current.findIndex(r => r.id === lastRowObj.id);
                    if (foundIdx !== -1) insertIdx = foundIdx + 1;
                }

                const duplicates = rowsToDuplicate.map((row, idx) => ({
                    id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${idx}`,
                    name: row.name ? `${row.name} (Copy)` : 'Copy',
                    job_name: row.job_name || '',
                    contact_person: row.contact_person || '',
                    designation: row.designation || '',
                    telephone_no: row.telephone_no || '',
                    email: row.email || '',
                    address: row.address || '',
                    category: row.category || 'Contractor',
                    location: row.location || '',
                    remarks: row.remarks || '',
                    _status: 'new',
                    _errors: {}
                }));

                setGridData(prev => {
                    const next = [...prev];
                    next.splice(insertIdx, 0, ...duplicates);
                    return next;
                });

                const targetFocusRow = bounds.maxRow + 1;
                const targetCol = bounds ? bounds.minCol : 0;
                setSelectionAnchor({ r: targetFocusRow, c: targetCol });
                setSelectionFocus({ r: targetFocusRow + duplicates.length - 1, c: targetCol });
                showToast('sparkle', 'Duplicated Row(s) (Ctrl+D)', `Created ${duplicates.length} duplicate row(s) right below selection.`);
            }
        } else {
            // Fill down cell values
            let updatedGrid = [...gridDataRef.current];
            let numCellsFilled = 0;

            if (bounds.minRow === bounds.maxRow) {
                // Single row / cell selection: copy from row above
                if (bounds.minRow > 0) {
                    const sourceRowObj = sortedGridDataRef.current[bounds.minRow - 1];
                    const targetRowObj = sortedGridDataRef.current[bounds.minRow];
                    if (sourceRowObj && targetRowObj) {
                        const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
                        if (realIdx !== -1) {
                            const rowCopy = { ...updatedGrid[realIdx] };
                            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                                const colName = GRID_COLUMNS[c];
                                rowCopy[colName] = sourceRowObj[colName] ?? '';
                                numCellsFilled++;
                            }
                            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                            updatedGrid[realIdx] = rowCopy;
                        }
                    }
                } else {
                    showToast('info', 'Fill Down', 'No row above to copy from.');
                    return;
                }
            } else {
                // Range selection (multiple rows): fill from top row of range down
                const sourceRowObj = sortedGridDataRef.current[bounds.minRow];
                if (sourceRowObj) {
                    for (let r = bounds.minRow + 1; r <= bounds.maxRow; r++) {
                        const targetRowObj = sortedGridDataRef.current[r];
                        if (!targetRowObj) continue;
                        const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
                        if (realIdx === -1) continue;

                        const rowCopy = { ...updatedGrid[realIdx] };
                        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                            const colName = GRID_COLUMNS[c];
                            rowCopy[colName] = sourceRowObj[colName] ?? '';
                            numCellsFilled++;
                        }
                        if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                        updatedGrid[realIdx] = rowCopy;
                    }
                }
            }

            if (numCellsFilled > 0) {
                setGridData(updatedGrid);
                setEditingCell(null);
                showToast('sparkle', 'Filled Down (Ctrl+D)', `Duplicated value from row above across ${numCellsFilled} cell(s). Click "Save Changes" to apply.`);
            }
        }
    };

    // ─── Global Keyboard Shortcuts (Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+A, Ctrl+Z, Ctrl+Y) ───
    useEffect(() => {
        const handleGlobalShortcuts = (e) => {
            const activeEl = document.activeElement;
            const activeTag = activeEl?.tagName?.toLowerCase();
            const isEditingText = activeTag === 'input' || activeTag === 'textarea';

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
            if (!isEditingText && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (canWrite) {
                    const curSelectedIds = selectedIdsRef.current;
                    const bounds = getBoundsFromRefs();
                    if (curSelectedIds.size > 0) {
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
                // Allow native copy when text is highlighted inside an input
                if (isEditingText && activeEl?.selectionStart !== activeEl?.selectionEnd) {
                    return;
                }
                // Only intercept if we have a spreadsheet selection
                const hasSel = selectedIdsRef.current.size > 0 || selectionAnchorRef.current !== null;
                if (hasSel) {
                    e.preventDefault();
                    executeCopy();
                }
                return;
            }

            // Ctrl+X / Cmd+X : Cut
            if (modifier && (e.key === 'x' || e.key === 'X')) {
                if (!isEditingText && canWrite) {
                    const hasSel = selectedIdsRef.current.size > 0 || selectionAnchorRef.current !== null;
                    if (hasSel) {
                        e.preventDefault();
                        executeCut();
                    }
                    return;
                }
            }

            // Ctrl+V / Cmd+V : Paste — let the native 'paste' event fire
            // for synchronous clipboardData access (avoids async permission issues).
            if (modifier && (e.key === 'v' || e.key === 'V')) {
                if (!isEditingText && canWrite) {
                    const hasSel = selectedIdsRef.current.size > 0 || selectionAnchorRef.current !== null;
                    if (hasSel) {
                        // Do NOT preventDefault — let the browser fire the 'paste' event
                        // which our handleNativePaste handler will intercept.
                        return;
                    }
                }
            }

            // Ctrl+D / Cmd+D : Duplicate / Fill Down
            if (modifier && (e.key === 'd' || e.key === 'D')) {
                if (canWrite) {
                    e.preventDefault();
                    executeDuplicate();
                    return;
                }
            }

            // Ctrl+A / Cmd+A : Select All
            if (modifier && (e.key === 'a' || e.key === 'A')) {
                if (!isEditingText) {
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
            }

            // Ctrl+Z / Cmd+Z : Undo
            if (modifier && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                if (!isEditingText) {
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
            }

            // Ctrl+Y / Cmd+Y or Ctrl+Shift+Z : Redo
            if (modifier && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
                if (!isEditingText) {
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
            }
        };

        window.addEventListener('keydown', handleGlobalShortcuts);
        return () => window.removeEventListener('keydown', handleGlobalShortcuts);
    }, [canWrite]);

    // ─── Native Browser Copy/Paste event handlers (fires when focus is NOT on an input) ─
    useEffect(() => {
        const handleNativeCopy = (e) => {
            const activeEl = document.activeElement;
            const activeTag = activeEl?.tagName?.toLowerCase();
            // If text is selected inside an input, allow native copy
            if ((activeTag === 'input' || activeTag === 'textarea') &&
                activeEl.selectionStart !== activeEl.selectionEnd) {
                return;
            }
            // Only intercept if we have a spreadsheet selection
            const curSelectedIds = selectedIdsRef.current;
            const anchor = selectionAnchorRef.current;
            if (curSelectedIds.size === 0 && !anchor) return;

            const bounds = getBoundsFromRefs();
            let rowsToCopy = [];
            let minCol = 0;
            let maxCol = GRID_COLUMNS.length - 1;

            if (curSelectedIds.size > 0) {
                rowsToCopy = sortedGridDataRef.current.filter(r => curSelectedIds.has(r.id));
            } else if (bounds) {
                for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                    if (sortedGridDataRef.current[r]) rowsToCopy.push(sortedGridDataRef.current[r]);
                }
                minCol = bounds.minCol;
                maxCol = bounds.maxCol;
            }

            if (rowsToCopy.length === 0) return;

            e.preventDefault();
            const tsvLines = rowsToCopy.map(rowObj => {
                const rowVals = [];
                for (let c = minCol; c <= maxCol; c++) {
                    rowVals.push(rowObj[GRID_COLUMNS[c]] ?? '');
                }
                return rowVals.join('\t');
            });
            const tsvData = tsvLines.join('\n');
            e.clipboardData.setData('text/plain', tsvData);
            internalClipboardRef.current = tsvData;
            const numCells = tsvLines.length * (maxCol - minCol + 1);
            showToast('sparkle', '', numCells === 1 ? 'Copied 1 cell to clipboard' : `Copied ${numCells} cells to clipboard`);
        };

        const handleNativePaste = (e) => {
            const pastedData = e.clipboardData?.getData('text/plain');
            if (!pastedData || !pastedData.trim()) return;

            const activeEl = document.activeElement;
            const activeTag = activeEl?.tagName?.toLowerCase();
            const isInInput = activeTag === 'input' || activeTag === 'textarea';

            // If an input/textarea is focused, only intercept if the pasted text
            // is multi-cell (contains tabs or newlines) — i.e. it's from Excel/Sheets.
            const isMultiCell = pastedData.includes('\t') || pastedData.includes('\n');

            if (isInInput && !isMultiCell) return;

            // Require at least a cell or row to be selected
            if (!selectionAnchorRef.current && selectedIdsRef.current.size === 0) return;

            e.preventDefault();
            // Use ref to avoid stale closure — always calls the latest executePaste
            executePasteRef.current(pastedData);
        };

        window.addEventListener('copy', handleNativeCopy);
        window.addEventListener('paste', handleNativePaste);
        return () => {
            window.removeEventListener('copy', handleNativeCopy);
            window.removeEventListener('paste', handleNativePaste);
        };
    }, []);

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
        } else {
            const allIds = new Set(sortedGridData.map(r => r.id));
            setSelectedIds(allIds);
        }
    };

    const handleToggleSelectRow = (e, id) => {
        e?.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (e?.shiftKey && lastSelectedId) {
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

    // Cell Management
    const handleCellChange = (rowIndex, field, value, isAtomic = false) => {
        if (isAtomic) {
            pushUndoState(gridDataRef.current);
        } else if (!cellEditInitialStateRef.current) {
            cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
        }
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
            const original = originalVendorsMap.get(row.id);
            if (Object.keys(errors).length === 0) {
                delete row._errors;
                if (!original || row._status === 'new') {
                    row._status = 'new';
                } else {
                    const isDirty = isVendorRowDirty(row, original);
                    row._status = isDirty ? 'modified' : 'saved';
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
        if (cellEditInitialStateRef.current) {
            const initial = cellEditInitialStateRef.current;
            const current = gridDataRef.current;
            const isChanged = initial.length !== current.length || initial.some((r, i) => r !== current[i]);
            if (isChanged) {
                pushUndoState(initial);
            }
            cellEditInitialStateRef.current = null;
        }
        setEditingCell(null);
    };

    const deleteSelectedRowEntries = async (rowsToDelete) => {
        pushUndoState(gridDataRef.current);
        const rowIds = new Set(rowsToDelete.map(r => r.id));
        const savedIds = rowsToDelete.filter(r => !String(r.id).startsWith('temp_')).map(r => r.id);

        setVendors(prev => prev.filter(r => !rowIds.has(r.id)));
        setGridData(prev => prev.filter(r => !rowIds.has(r.id)));
        setSelectedIds(prev => {
            const next = new Set(prev);
            rowIds.forEach(id => next.delete(id));
            return next;
        });
        setSelectionAnchor(null);
        setSelectionFocus(null);
        showToast('success', 'Entry Deleted', `Deleted ${rowsToDelete.length} vendor entry(ies) locally. Click "Save Changes" to apply.`);

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
            const inputEl = e.target;
            const isInput = inputEl?.tagName?.toLowerCase() === 'input' || inputEl?.tagName?.toLowerCase() === 'textarea';
            const selStart = isInput ? (inputEl.selectionStart ?? 0) : 0;
            const selEnd = isInput ? (inputEl.selectionEnd ?? 0) : 0;
            const valLen = isInput ? (inputEl.value?.length ?? 0) : 0;

            if (e.key === 'Enter') {
                e.preventDefault();
                handleCellBlur();
                const nextRow = e.shiftKey ? Math.max(0, rowIndex - 1) : Math.min(totalRows - 1, rowIndex + 1);
                setSelectionAnchor({ r: nextRow, c: colIndex });
                setSelectionFocus({ r: nextRow, c: colIndex });
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                if (cellEditInitialStateRef.current) {
                    setGridData(cellEditInitialStateRef.current);
                    cellEditInitialStateRef.current = null;
                }
                setEditingCell(null);
                return;
            }

            if (e.key === 'Tab') {
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
                return;
            }

            // ArrowUp: Commit edit and move up
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleCellBlur();
                const targetRow = isModifier ? 0 : Math.max(0, rowIndex - 1);
                setSelectionAnchor({ r: targetRow, c: colIndex });
                setSelectionFocus({ r: targetRow, c: colIndex });
                return;
            }

            // ArrowDown: Commit edit and move down
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleCellBlur();
                const targetRow = isModifier ? Math.max(0, totalRows - 1) : Math.min(totalRows - 1, rowIndex + 1);
                setSelectionAnchor({ r: targetRow, c: colIndex });
                setSelectionFocus({ r: targetRow, c: colIndex });
                return;
            }

            // ArrowLeft: If cursor is at the start (pos 0) or modifier pressed, navigate left
            if (e.key === 'ArrowLeft') {
                if (isModifier || (selStart === 0 && selEnd === 0)) {
                    e.preventDefault();
                    handleCellBlur();
                    const targetCol = isModifier ? 0 : Math.max(0, colIndex - 1);
                    setSelectionAnchor({ r: rowIndex, c: targetCol });
                    setSelectionFocus({ r: rowIndex, c: targetCol });
                    return;
                }
            }

            // ArrowRight: If cursor is at the end (pos valLen) or modifier pressed, navigate right
            if (e.key === 'ArrowRight') {
                if (isModifier || (selStart === valLen && selEnd === valLen)) {
                    e.preventDefault();
                    handleCellBlur();
                    const targetCol = isModifier ? totalCols - 1 : Math.min(totalCols - 1, colIndex + 1);
                    setSelectionAnchor({ r: rowIndex, c: targetCol });
                    setSelectionFocus({ r: rowIndex, c: targetCol });
                    return;
                }
            }

            // PageUp & PageDown while editing
            if (e.key === 'PageUp') {
                e.preventDefault();
                handleCellBlur();
                const targetRow = Math.max(0, rowIndex - 10);
                setSelectionAnchor({ r: targetRow, c: colIndex });
                setSelectionFocus({ r: targetRow, c: colIndex });
                return;
            }

            if (e.key === 'PageDown') {
                e.preventDefault();
                handleCellBlur();
                const targetRow = Math.min(Math.max(0, totalRows - 1), rowIndex + 10);
                setSelectionAnchor({ r: targetRow, c: colIndex });
                setSelectionFocus({ r: targetRow, c: colIndex });
                return;
            }

            // Ctrl+Home / Ctrl+End while editing
            if (isModifier && e.key === 'Home') {
                e.preventDefault();
                handleCellBlur();
                setSelectionAnchor({ r: 0, c: 0 });
                setSelectionFocus({ r: 0, c: 0 });
                return;
            }

            if (isModifier && e.key === 'End') {
                e.preventDefault();
                handleCellBlur();
                setSelectionAnchor({ r: Math.max(0, totalRows - 1), c: totalCols - 1 });
                setSelectionFocus({ r: Math.max(0, totalRows - 1), c: totalCols - 1 });
                return;
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
                if (colName === 'job_name' || colName === 'category') {
                    setActiveDropdownCell({ rowIndex: curFocus.r, colName });
                } else {
                    cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                    setEditingCell({ rowIndex: curFocus.r, colName });
                }
            }
            return;
        }

        // Direct typing replaces cell content
        if (canWrite && e.key.length === 1 && !isModifier && !e.altKey) {
            if (colName !== 'job_name' && colName !== 'category') {
                cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                setEditingCell({ rowIndex: curFocus.r, colName });
                handleCellChange(curFocus.r, colName, e.key);
            }
        }
    };

    // Add Row (inserted at the bottom of the table)
    const handleAddRows = (count = 1) => {
        pushUndoState(gridDataRef.current);
        const gridInsertIdx = gridDataRef.current.length;
        const sortedRowIdx = sortedGridDataRef.current.length;

        const newRows = Array.from({ length: count }).map((_, idx) => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${idx}`,
            name: '',
            job_name: '',
            contact_person: '',
            designation: '',
            telephone_no: '',
            email: '',
            address: '',
            category: 'Contractor',
            location: '',
            remarks: '',
            _status: 'new',
            _errors: {}
        }));

        setGridData(prev => {
            const next = [...prev];
            next.splice(gridInsertIdx, 0, ...newRows);
            return next;
        });

        if (pageSize !== 'All') {
            const targetPage = Math.floor(sortedRowIdx / Number(pageSize)) + 1;
            if (targetPage !== currentPage) {
                setCurrentPage(targetPage);
            }
        }

        setSelectionAnchor({ r: sortedRowIdx, c: 0 });
        setSelectionFocus({ r: sortedRowIdx + count - 1, c: 0 });
        showToast('info', 'Rows Added', `Added ${count} new vendor row(s) at the bottom.`);
    };

    // Duplicate Row (inserted right below duplicated row)
    const handleDuplicateRow = (row) => {
        pushUndoState(gridDataRef.current);
        const duplicate = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${Math.floor(Math.random() * 1000)}`,
            name: row.name ? `${row.name} (Copy)` : 'New Copy',
            job_name: row.job_name || '',
            contact_person: row.contact_person || '',
            designation: row.designation || '',
            telephone_no: row.telephone_no || '',
            email: row.email || '',
            address: row.address || '',
            category: row.category || 'Contractor',
            location: row.location || '',
            remarks: row.remarks || '',
            _status: 'new',
            _errors: {}
        };

        let realIdx = gridDataRef.current.length;
        let sortedIdx = sortedGridDataRef.current.length;
        if (row && row.id) {
            const foundIdx = gridDataRef.current.findIndex(r => r.id === row.id);
            if (foundIdx !== -1) realIdx = foundIdx + 1;
            const foundSortedIdx = sortedGridDataRef.current.findIndex(r => r.id === row.id);
            if (foundSortedIdx !== -1) sortedIdx = foundSortedIdx + 1;
        }

        setGridData(prev => {
            const next = [...prev];
            next.splice(realIdx, 0, duplicate);
            return next;
        });

        const targetPage = pageSize !== 'All' ? Math.floor(sortedIdx / Number(pageSize)) + 1 : 1;
        if (pageSize !== 'All' && targetPage !== currentPage) {
            setCurrentPage(targetPage);
            showToast('sparkle', 'Row Duplicated', `Duplicated "${row.name || 'vendor'}" to Page ${targetPage} (Row ${sortedIdx + 1}).`);
        } else {
            showToast('sparkle', 'Row Duplicated', `Duplicated "${row.name || 'vendor'}" right below.`);
        }

        setSelectionAnchor({ r: sortedIdx, c: 0 });
        setSelectionFocus({ r: sortedIdx, c: 0 });
    };

    // Remove Duplicate Vendors Modal Handler
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
            setVendors(prev => prev.filter(v => !savedRemovedIds.includes(v.id)));
        }

        showToast('success', 'Duplicates Removed', `Removed ${idsToDelete.length} selected duplicate vendor(s) locally. Click "Save Changes" to apply.`);
    };

    // Bulk Actions
    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;

        setConfirmModal({
            isOpen: true,
            title: 'Delete Selected Vendors?',
            message: `Are you sure you want to delete ${selectedIds.size} selected vendor(s)? Click "Save Changes" after deletion to apply to cloud.`,
            confirmText: `Delete (${selectedIds.size})`,
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                pushUndoState(gridDataRef.current);
                const idsToDelete = Array.from(selectedIds);
                const savedIds = idsToDelete.filter(id => !String(id).startsWith('temp_'));
                const count = selectedIds.size;

                setVendors(prev => prev.filter(r => !selectedIds.has(r.id)));
                setGridData(prev => prev.filter(r => !selectedIds.has(r.id)));
                setSelectedIds(new Set());
                if (viewingVendor && selectedIds.has(viewingVendor.id)) {
                    setViewingVendor(null);
                }
                closeConfirmModal();
                showToast('success', 'Bulk Delete Successful', `Deleted ${count} selected vendor(s) locally. Click "Save Changes" to apply.`);

                if (savedIds.length > 0) {
                    setDeletedIds(prev => new Set([...prev, ...savedIds]));
                }
            }
        });
    };

    const handleBulkDuplicate = () => {
        const curSelectedIds = selectedIdsRef.current;
        if (curSelectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);

        const selectedRows = sortedGridDataRef.current.filter(r => curSelectedIds.has(r.id));
        const lastSelectedRow = selectedRows[selectedRows.length - 1];

        let insertIdx = gridDataRef.current.length;
        let lastSortedIdx = sortedGridDataRef.current.length;
        if (lastSelectedRow) {
            const foundIdx = gridDataRef.current.findIndex(r => r.id === lastSelectedRow.id);
            if (foundIdx !== -1) insertIdx = foundIdx + 1;
            const foundSorted = sortedGridDataRef.current.findIndex(r => r.id === lastSelectedRow.id);
            if (foundSorted !== -1) lastSortedIdx = foundSorted + 1;
        }

        const duplicates = selectedRows.map((row, idx) => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${idx}`,
            name: row.name ? `${row.name} (Copy)` : 'Copy',
            job_name: row.job_name || '',
            contact_person: row.contact_person || '',
            designation: row.designation || '',
            telephone_no: row.telephone_no || '',
            email: row.email || '',
            address: row.address || '',
            category: row.category || 'Contractor',
            location: row.location || '',
            remarks: row.remarks || '',
            _status: 'new',
            _errors: {}
        }));

        setGridData(prev => {
            const next = [...prev];
            next.splice(insertIdx, 0, ...duplicates);
            return next;
        });

        const count = curSelectedIds.size;
        setSelectedIds(new Set());
        setSelectionAnchor({ r: lastSortedIdx, c: 0 });
        setSelectionFocus({ r: lastSortedIdx + duplicates.length - 1, c: 0 });
        showToast('sparkle', 'Bulk Duplicated', `Created ${count} duplicate row(s) right below selection.`);
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

    const handleBulkChangeCategory = (newCat) => {
        if (selectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);
        const count = selectedIds.size;
        setGridData(prev => prev.map(row => {
            if (selectedIds.has(row.id)) {
                return {
                    ...row,
                    category: newCat,
                    _status: row._status === 'new' ? 'new' : 'modified'
                };
            }
            return row;
        }));
        closeDropdown();
        showToast('sparkle', 'Category Updated', `Changed Category to "${newCat}" for ${count} row(s). Click "Save Changes" to apply.`);
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
            title: 'Delete Vendor?',
            message: `Are you sure you want to delete "${row.name || 'this vendor'}"? Click "Save Changes" after deletion to apply to cloud.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                pushUndoState(gridDataRef.current);
                setVendors(prev => prev.filter(r => r.id !== row.id));
                setGridData(prev => prev.filter(r => r.id !== row.id));
                if (viewingVendor?.id === row.id) {
                    setViewingVendor(null);
                }
                closeConfirmModal();
                showToast('success', 'Vendor Deleted', `Deleted "${row.name || 'Vendor'}" locally. Click "Save Changes" to apply.`);
                if (!String(row.id).startsWith('temp_')) {
                    setDeletedIds(prev => new Set([...prev, row.id]));
                }
            }
        });
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = ['Company Name', 'Nature of Job', 'Contact Person', 'Designation', 'Contact No', 'Email ID', 'Address', 'Category', 'Location', 'Remarks'];
        const csvRows = sortedGridData.map(r => [
            r.name || '',
            r.job_name || '',
            r.contact_person || '',
            r.designation || '',
            r.telephone_no || '',
            r.email || '',
            r.address || '',
            r.category || '',
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
        link.setAttribute("download", `mano_vendors_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('success', 'Export Complete', `Exported ${sortedGridData.length} vendors to CSV.`);
    };

    const handleSaveVendorFromModal = (vendorData) => {
        try {
            pushUndoState(gridDataRef.current);
            const mappedData = {
                name: vendorData.name || '',
                category: vendorData.category || 'Contractor',
                contact_person: vendorData.contact_person || '',
                designation: vendorData.designation || '',
                telephone_no: vendorData.contact_no || vendorData.telephone_no || '',
                email: vendorData.email || '',
                address: vendorData.address || '',
                job_name: vendorData.job_nature || vendorData.job_name || '',
                location: vendorData.location || '',
                remarks: vendorData.remarks || ''
            };

            if (editingVendor) {
                setGridData(prevGrid => prevGrid.map(row => {
                    if (row.id === editingVendor.id) {
                        return {
                            ...row,
                            ...mappedData,
                            _status: row._status === 'new' ? 'new' : 'modified'
                        };
                    }
                    return row;
                }));
                showToast('info', 'Vendor Updated (Local)', 'Vendor details updated in local draft. Click "Save Changes" to apply.');
            } else {
                const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                const newRow = {
                    id: tempId,
                    ...mappedData,
                    _status: 'new',
                    _errors: {}
                };
                const { gridInsertIdx, sortedRowIdx } = getTargetInsertIndex();
                setGridData(prevGrid => {
                    const next = [...prevGrid];
                    next.splice(gridInsertIdx, 0, newRow);
                    return next;
                });
                setSelectionAnchor({ r: sortedRowIdx, c: 0 });
                setSelectionFocus({ r: sortedRowIdx, c: 0 });
                showToast('info', 'Vendor Added (Local)', 'New vendor added to local draft right below selection.');
            }
            setIsAddModalOpen(false);
            setEditingVendor(null);
        } catch (err) {
            showToast('error', 'Save Failed', 'Failed to update local draft vendor');
        }
    };

    return (
        <>
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
                        { id: 'total', label: 'Total Vendors', value: stats.total, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-white/[0.03]' },
                        { id: 'jobs', label: 'Job Natures', value: stats.jobNaturesCount, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10' },
                        { id: 'categories', label: 'Categories', value: stats.categoriesCount, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10' },
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
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    <span>Unsaved local changes</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCancelChanges}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                                    title="Discard all unsaved local changes and revert to saved data"
                                >
                                    <RotateCcw size={12} className="stroke-[2.5]" />
                                    <span>Cancel Changes</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {/* Search Input */}
                    <div className="relative w-48">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search company, job, contact..."
                            className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Quick Category Filter Pills */}
                    <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 shrink-0">
                        {[{ value: '', label: 'All' }, ...CATEGORY_OPTIONS.slice(0, 4).map(c => ({ value: c, label: c }))].map(opt => {
                            const isSel = opt.value === '' ? activeFilters.categories.length === 0 : activeFilters.categories.includes(opt.value);
                            return (
                                <button
                                    key={opt.value || 'all'}
                                    onClick={() => {
                                        if (opt.value === '') {
                                            setActiveFilters(prev => ({ ...prev, categories: [] }));
                                        } else {
                                            setActiveFilters(prev => ({
                                                ...prev,
                                                categories: prev.categories.includes(opt.value) ? [] : [opt.value]
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

                    {/* Filter Dropdown Popup */}
                    <VendorFilterDropdown
                        activeFilters={activeFilters}
                        onApply={(newFilters) => setActiveFilters(newFilters)}
                        categoryOptions={CATEGORY_OPTIONS}
                        availableJobNatures={allJobNatures}
                    />

                    {/* Remove Duplicates */}
                    <button
                        onClick={handleRemoveDuplicates}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg text-xs font-semibold transition cursor-pointer"
                        title="Instantly find and remove duplicate rows"
                    >
                        <Copy size={13} />
                        <span>Remove Duplicates</span>
                    </button>

                    {/* Minimal Import & Excel Dropdown */}
                    {canWrite && (
                        <div className="relative inline-block" ref={excelDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsExcelDropdownOpen(!isExcelDropdownOpen)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-200 transition cursor-pointer whitespace-nowrap"
                                title="Import spreadsheet, paste from Excel, or download template"
                            >
                                <UploadCloud size={13} className="text-blue-600 dark:text-blue-400" />
                                <span>Import / Excel</span>
                                <ChevronDown size={12} className={`transition-transform ${isExcelDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isExcelDropdownOpen && (
                                <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[7000] py-1.5 text-xs text-gray-700 dark:text-gray-300 font-semibold overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none flex flex-col">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsExcelDropdownOpen(false);
                                            setExcelModalTab('upload');
                                            setIsExcelModalOpen(true);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                        <UploadCloud size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                        <span>Import Spreadsheet</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsExcelDropdownOpen(false);
                                            setExcelModalTab('paste');
                                            setIsExcelModalOpen(true);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                        <ClipboardPaste size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        <span>Paste from Excel</span>
                                    </button>

                                    <div className="border-t border-gray-100 dark:border-white/5 my-1"></div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsExcelDropdownOpen(false);
                                            downloadExcelTemplateFile();
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center gap-2.5 transition cursor-pointer"
                                    >
                                        <Download size={14} className="text-gray-500 shrink-0" />
                                        <span>Download Template</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Export CSV */}
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-800 border border-gray-200 dark:text-gray-400 dark:hover:text-white dark:border-white/10 bg-transparent rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                        title="Export CSV"
                    >
                        <Download size={13} />
                        <span>Export CSV</span>
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={() => fetchVendors(true)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer"
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
                                        Add Manual Vendor
                                    </button>
                                    <button
                                        onClick={() => { navigate('/vendors/bulk-upload'); setIsManageDropdownOpen(false); }}
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
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Bottom Action Toaster Dock */}
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[6500] bg-gray-900/95 dark:bg-[#161b22]/95 border border-blue-500/40 text-white shadow-2xl backdrop-blur-md rounded-2xl px-4 py-2 flex items-center gap-3 select-none text-xs"
                    >
                        <div className="flex items-center gap-2 pr-3 border-r border-white/10 font-semibold">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 rounded-xl font-bold text-xs text-white shadow-sm">
                                <CheckSquare size={13} />
                                {selectedIds.size} {selectedIds.size === 1 ? 'row' : 'rows'} selected
                            </span>
                        </div>

                        <div className="flex items-center gap-2 relative">
                            {canWrite && (
                                <>
                                    <button
                                        onClick={handleBulkDuplicate}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition text-white"
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
                                                setShowBulkCategoryMenu(false);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition text-white"
                                        >
                                            <span>Change Job Nature</span>
                                            <ChevronDown size={12} className={`transition-transform duration-200 ${showBulkJobMenu ? 'rotate-180' : ''}`} />
                                        </button>
                                        {showBulkJobMenu && (
                                            <div className="absolute left-0 bottom-full mb-2.5 w-56 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[7000] p-2 text-xs text-gray-800 dark:text-gray-200">
                                                <input
                                                    type="text"
                                                    placeholder="Search job nature..."
                                                    className="w-full px-2 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none mb-1 font-semibold text-gray-900 dark:text-white"
                                                    value={bulkJobSearch}
                                                    onChange={e => setBulkJobSearch(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            closeDropdown();
                                                        } else {
                                                            e.stopPropagation();
                                                        }
                                                    }}
                                                />
                                                <div className="max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                                    {allJobNatures
                                                        .filter(j => (j.job_name || '').toLowerCase().includes(bulkJobSearch.toLowerCase()))
                                                        .slice(0, 5)
                                                        .map(j => (
                                                            <button
                                                                key={j.job_id || j.job_name}
                                                                onClick={() => handleBulkChangeJob(j.job_name)}
                                                                className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg text-xs font-semibold"
                                                            >
                                                                {j.job_name}
                                                            </button>
                                                        ))
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bulk Change Category Dropdown */}
                                    <div className="relative">
                                        <button
                                            onClick={() => {
                                                setShowBulkCategoryMenu(v => !v);
                                                setShowBulkJobMenu(false);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition text-white"
                                        >
                                            <span>Change Category</span>
                                            <ChevronDown size={12} className={`transition-transform duration-200 ${showBulkCategoryMenu ? 'rotate-180' : ''}`} />
                                        </button>
                                        {showBulkCategoryMenu && (
                                            <div className="absolute left-0 bottom-full mb-2.5 w-48 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[7000] py-1 text-xs text-gray-800 dark:text-gray-200 font-medium flex flex-col">
                                                {CATEGORY_OPTIONS.map(cat => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => handleBulkChangeCategory(cat)}
                                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-white/5 font-semibold block whitespace-nowrap"
                                                    >
                                                        Set to {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition shadow-sm"
                                    >
                                        <Trash2 size={13} />
                                        Delete ({selectedIds.size})
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition ml-1"
                                title="Deselect all rows"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Layout */}
            <div ref={tableContainerRef} className="flex-1 min-h-0 flex overflow-hidden w-full relative">
                {/* Spreadsheet Grid Table */}
                <div className="flex-1 min-h-0 overflow-auto table-scrollbar">
                    <table className="w-full min-w-[1500px] table-fixed text-left whitespace-nowrap text-sm border-collapse bg-white dark:bg-[#0d1117] select-none">
                        <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-20 border-b border-gray-200 dark:border-white/5 tracking-wider text-[10px] uppercase font-bold select-none shadow-sm">
                            <tr>
                                {/* Master Checkbox */}
                                <th className="px-3 py-3 w-10 min-w-10 max-w-10 text-center border-r border-gray-150 dark:border-white/5">
                                    <div className="flex justify-center">
                                        <CustomCheckbox
                                            checked={sortedGridData.length > 0 && selectedIds.size === sortedGridData.length}
                                            onChange={handleSelectAll}
                                            title="Select All"
                                        />
                                    </div>
                                </th>
                                <th className="px-3 py-3 w-10 min-w-10 max-w-10 text-center border-r border-gray-150 dark:border-white/5">#</th>
                                <th className="px-1 py-3 w-[82px] min-w-[82px] max-w-[82px] text-center border-r border-gray-150 dark:border-white/5">Status</th>

                                {/* Sortable Columns */}
                                {GRID_COLUMNS.map(colName => (
                                    <th
                                        key={colName}
                                        onClick={() => handleSort(colName)}
                                        className={`px-3 py-3 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition ${COLUMN_WIDTH_CLASSES[colName] || 'w-[160px] min-w-[150px]'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="truncate">
                                                {COLUMN_LABELS[colName]}
                                                {colName === 'name' && <span className="text-red-500 ml-0.5">*</span>}
                                            </span>
                                            {sortConfig.key === colName && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                ))}

                                <th className="px-3 py-3 w-28 min-w-28 max-w-28 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {isLoading && vendors.length === 0 ? (
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
                                            <Building2 className="text-gray-300 dark:text-white/10" size={44} />
                                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No vendors found</p>
                                            <p className="text-xs text-gray-400">
                                                {searchTerm || activeFilters.jobs.length || activeFilters.categories.length
                                                    ? 'Adjust your search or filters'
                                                    : 'Import an Excel spreadsheet, paste copied cells from Excel, or click below to start.'}
                                            </p>
                                            {canWrite && (
                                                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddRows(1)}
                                                        className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition cursor-pointer shadow-xs"
                                                    >
                                                        + Add First Vendor
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setExcelModalTab('upload');
                                                            setIsExcelModalOpen(true);
                                                        }}
                                                        className="px-3.5 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                                    >
                                                        <UploadCloud size={13} />
                                                        <span>Import Spreadsheet</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setExcelModalTab('paste');
                                                            setIsExcelModalOpen(true);
                                                        }}
                                                        className="px-3.5 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                                    >
                                                        <ClipboardPaste size={13} />
                                                        <span>Paste from Excel</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedGridData.map((vendor, index) => {
                                    const rowIndex = pageSize === 'All' ? index : (currentPage - 1) * Number(pageSize) + index;
                                    const originalVendor = originalVendorsMap.get(vendor.id);
                                    const isNew = vendor._status === 'new' || String(vendor.id).startsWith('temp_');
                                    const isError = vendor._status === 'error';
                                    const isDirty = (vendor._status === 'modified') || (originalVendor && isVendorRowDirty(vendor, originalVendor));
                                    const rowErrors = vendor._errors || {};
                                    const isRowSelected = selectedIds.has(vendor.id);

                                    return (
                                        <tr
                                            key={vendor.id || `row-${rowIndex}`}
                                            onContextMenu={(e) => handleContextMenu(e, rowIndex, 0)}
                                            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 42px' }}
                                            className={`hover:bg-blue-50/20 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 ${isRowSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                                                }`}
                                        >
                                            {/* Checkbox Cell */}
                                            <td className="px-3 py-3 text-center border-r border-gray-100 dark:border-white/5 select-none">
                                                <div className="flex justify-center">
                                                    <CustomCheckbox
                                                        checked={isRowSelected}
                                                        onChange={(e) => handleToggleSelectRow(e, vendor.id)}
                                                        title="Select Row"
                                                    />
                                                </div>
                                            </td>

                                            {/* Row # */}
                                            <td className="px-3 py-3 text-center font-mono text-[10px] text-gray-400 border-r border-gray-100 dark:border-white/5 select-none bg-gray-50/50 dark:bg-white/[0.01]">
                                                {rowIndex + 1}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-1 py-2.5 text-center border-r border-gray-100 dark:border-white/5 select-none">
                                                {isNew ? (
                                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 whitespace-nowrap">
                                                        NEW
                                                    </span>
                                                ) : isError ? (
                                                    <span
                                                        className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-500/20 whitespace-nowrap cursor-help"
                                                        title={rowErrors.name || 'Validation error'}
                                                    >
                                                        ERROR
                                                    </span>
                                                ) : isDirty ? (
                                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 whitespace-nowrap">
                                                        MODIFIED
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 whitespace-nowrap">
                                                        SAVED
                                                    </span>
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
                                                const isFillHandleCell = bounds && rowIndex === bounds.maxRow && colIndex === bounds.maxCol;

                                                const rawValue = vendor[colName] || '';

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
                                                            if (selectionAnchor?.r !== rowIndex || selectionAnchor?.c !== colIndex || selectionFocus?.r !== rowIndex || selectionFocus?.r !== rowIndex || selectionFocus?.c !== colIndex) {
                                                                setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                setSelectionFocus({ r: rowIndex, c: colIndex });
                                                            }
                                                        }}
                                                        onMouseEnter={() => {
                                                            if (isMouseDown && (selectionFocus?.r !== rowIndex || selectionFocus?.c !== colIndex)) {
                                                                setSelectionFocus({ r: rowIndex, c: colIndex });
                                                            }
                                                        }}
                                                        onClick={(e) => {
                                                            if (e.target.closest('.z-\\[6000\\]') || e.target.closest('button')) return;
                                                            if (canWrite) {
                                                                if (selectionAnchor?.r !== rowIndex || selectionAnchor?.c !== colIndex) {
                                                                    setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                    setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                }
                                                                if (colName === 'job_name' || colName === 'category') {
                                                                    setActiveDropdownCell({ rowIndex, colName });
                                                                } else {
                                                                    cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                                                                    setEditingCell({ rowIndex, colName });
                                                                }
                                                            }
                                                        }}
                                                        onDoubleClick={() => {
                                                            if (canWrite) {
                                                                if (colName === 'job_name' || colName === 'category') {
                                                                    setActiveDropdownCell({ rowIndex, colName });
                                                                } else {
                                                                    cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                                                                    setEditingCell({ rowIndex, colName });
                                                                }
                                                            }
                                                        }}
                                                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colName)}
                                                        onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
                                                        className={`px-3 py-2 border-r border-b border-gray-100 dark:border-white/5 relative outline-none select-none cursor-pointer overflow-hidden ${COLUMN_WIDTH_CLASSES[colName] || 'w-[160px] min-w-[150px]'} ${isEditing
                                                            ? 'bg-white dark:bg-[#161b22]'
                                                            : isInRange
                                                                ? 'bg-blue-50/50 dark:bg-blue-900/20'
                                                                : 'hover:bg-gray-50/70 dark:hover:bg-white/[0.03]'
                                                            }`}
                                                    >
                                                        {/* Active Cell / Anchor Blue Border Marker Overlay */}
                                                        {(isAnchor || isEditing) && (
                                                            <div className="absolute inset-0 pointer-events-none z-20 border-2 border-blue-500 shadow-xs" />
                                                        )}

                                                        {/* Fill Handle Marker */}
                                                        {isFillHandleCell && !isEditing && (
                                                            <div
                                                                onMouseDown={(e) => {
                                                                    e.stopPropagation();
                                                                    setIsMouseDown(true);
                                                                }}
                                                                onDoubleClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAutoFillDown();
                                                                }}
                                                                className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-600 border border-white dark:border-gray-900 rounded-sm z-30 cursor-crosshair shadow-sm hover:scale-125 transition-transform"
                                                                title="Drag or double-click to Auto-Fill Down"
                                                            />
                                                        )}

                                                        {/* Selection Range Border Overlay */}
                                                        {isInRange && !isAnchor && !isEditing && (
                                                            <div className="absolute inset-0 pointer-events-none z-10">
                                                                {isTopEdge && <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />}
                                                                {isBottomEdge && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500" />}
                                                                {isLeftEdge && <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-blue-500" />}
                                                                {isRightEdge && <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-blue-500" />}
                                                            </div>
                                                        )}

                                                        {/* In-Cell Text Editing Input */}
                                                        {isEditing ? (
                                                            <div className="w-full flex items-center min-w-0 overflow-hidden">
                                                                <input
                                                                    type="text"
                                                                    autoFocus
                                                                    value={rawValue}
                                                                    onChange={(e) => handleCellChange(rowIndex, colName, e.target.value)}
                                                                    onBlur={handleCellBlur}
                                                                    onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colName)}
                                                                    onPaste={(e) => {
                                                                        const text = e.clipboardData?.getData('text/plain');
                                                                        if (text && (text.includes('\t') || text.includes('\n') || text.includes('\r'))) {
                                                                            e.preventDefault();
                                                                            setEditingCell(null);
                                                                            setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                            setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                            executePasteRef.current(text, rowIndex, colIndex);
                                                                        }
                                                                    }}
                                                                    className={`w-full min-w-0 max-w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 p-0 text-sm ${colName === 'name' ? 'font-bold' : 'font-semibold'} text-gray-900 dark:text-white relative z-10`}
                                                                />
                                                            </div>
                                                        ) : colName === 'job_name' ? (
                                                            /* Nature of Job Dropdown Cell — portal-based */
                                                            <div className="group/cell flex items-center justify-between w-full">
                                                                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                                                    {rawValue || <span className="text-gray-400 dark:text-gray-500 font-normal italic">Select job nature...</span>}
                                                                </span>
                                                                {canWrite && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (allJobNatures.length === 0) fetchMetadata();
                                                                            const rect = e.currentTarget.closest('td')?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect();
                                                                            const isOpen = dropdownPortalProps?.rowIndex === rowIndex && dropdownPortalProps?.colName === 'job_name';
                                                                            if (isOpen) {
                                                                                setDropdownPortalProps(null);
                                                                                setJobNatureSearch('');
                                                                            } else {
                                                                                setDropdownPortalProps({ rowIndex, colName: 'job_name', top: rect.bottom + 4, left: rect.left });
                                                                                setJobNatureSearch('');
                                                                            }
                                                                        }}
                                                                        className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-400 opacity-60 group-hover/cell:opacity-100 transition-opacity"
                                                                    >
                                                                        <ChevronDown size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : colName === 'category' ? (
                                                            /* Category Dropdown Cell */
                                                            <div className="relative group/cell flex items-center justify-between w-full">
                                                                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                                                    {rawValue || 'Contractor'}
                                                                </span>
                                                                {canWrite && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveDropdownCell(prev => (prev?.rowIndex === rowIndex && prev?.colName === 'category') ? null : { rowIndex, colName: 'category' });
                                                                        }}
                                                                        className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-400 opacity-60 group-hover/cell:opacity-100 transition-opacity"
                                                                    >
                                                                        <ChevronDown size={12} />
                                                                    </button>
                                                                )}

                                                                {/* Category Popup Menu */}
                                                                {activeDropdownCell?.rowIndex === rowIndex && activeDropdownCell?.colName === 'category' && (
                                                                    <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-2xl z-[6000] py-1 text-xs text-gray-800 dark:text-gray-200 flex flex-col">
                                                                        {CATEGORY_OPTIONS.map(cat => (
                                                                            <button
                                                                                key={cat}
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleCellChange(rowIndex, 'category', cat, true);
                                                                                    closeDropdown();
                                                                                }}
                                                                                className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 font-semibold block whitespace-nowrap text-gray-800 dark:text-gray-200"
                                                                            >
                                                                                {cat}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            /* Default Text Cell */
                                                            <div className="truncate w-full font-medium">
                                                                {rawValue ? (
                                                                    colName === 'name' ? (
                                                                        <span className="font-bold text-gray-900 dark:text-white">{rawValue}</span>
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
                                                        onClick={() => setViewingVendor(vendor)}
                                                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                                                        title="View Vendor Details"
                                                    >
                                                        <Info size={15} />
                                                    </button>
                                                    {canWrite && (
                                                        <>
                                                            <button
                                                                onClick={() => handleDuplicateRow(vendor)}
                                                                className="p-1 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition"
                                                                title="Duplicate Row"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteRow(vendor)}
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

                {/* Vendor Detail Sidebar */}
                {viewingVendor && (
                    <VendorDetails
                        isOpen={!!viewingVendor}
                        onClose={() => setViewingVendor(null)}
                        vendor={viewingVendor}
                        onEdit={(v) => { setViewingVendor(null); setEditingVendor(v); setIsAddModalOpen(true); }}
                        onDelete={(id) => { setViewingVendor(null); handleDeleteRow({ id, name: viewingVendor.name }); }}
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

            <AddEditVendor
                isOpen={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setEditingVendor(null); }}
                initialData={editingVendor}
                onSave={handleSaveVendorFromModal}
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
                    fetchVendors();
                    fetchMetadata();
                }}
            />

            <DuplicateResolverModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                title="Remove Duplicate Vendors"
                gridData={gridData}
                getKey={(row) => {
                    const cleanName = (row.name || '').replace(/\s*\(\s*copy(?:\s+\d+)?\s*\)/gi, '').trim().toLowerCase();
                    const email = (row.email || '').trim().toLowerCase();
                    const phone = (row.telephone_no || '').trim().toLowerCase();
                    return cleanName || email || phone;
                }}
                getLabel={(row) => row.name || 'Unnamed Vendor'}
                getSubLabel={(row) => [row.job_name, row.email, row.telephone_no].filter(Boolean).join(' • ')}
                onDeleteDuplicates={handleConfirmDeleteDuplicates}
            />

            {/* Right-Click Context Menu Overlay */}
            {contextMenu && (
                <div
                    data-context-menu="true"
                    className="fixed bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[9000] py-1.5 w-56 text-xs select-none backdrop-blur-md"
                    style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
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
                            onClick={async (e) => {
                                e.stopPropagation();
                                const targetRow = contextMenu.rowIndex;
                                const targetCol = contextMenu.colIndex;
                                setContextMenu(null);
                                let text = '';
                                if (navigator.clipboard && navigator.clipboard.readText) {
                                    try {
                                        text = await navigator.clipboard.readText();
                                    } catch (err) {
                                        text = internalClipboardRef.current;
                                    }
                                }
                                if (!text && internalClipboardRef.current) {
                                    text = internalClipboardRef.current;
                                }
                                if (text && text.trim()) {
                                    executePasteRef.current(text, targetRow, targetCol);
                                } else {
                                    showToast('info', 'Clipboard Empty', 'No content available to paste. Copy cells or use Ctrl+V.');
                                }
                            }}
                            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold border-b border-gray-100 dark:border-white/5 pb-1.5 mb-1"
                        >
                            <span>Paste</span>
                            <span className="text-[10px] font-mono text-gray-400">Ctrl+V</span>
                        </button>
                    )}

                    {canWrite && ((bounds && bounds.minRow < bounds.maxRow) || selectedIds.size > 1) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
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
                            onClick={(e) => {
                                e.stopPropagation();
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const rIdx = contextMenu.rowIndex;
                                    setContextMenu(null);
                                    handleInsertRow(rIdx, 'above');
                                }}
                                className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold"
                            >
                                <span>Insert Row Above</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const rIdx = contextMenu.rowIndex;
                                    setContextMenu(null);
                                    handleInsertRow(rIdx, 'below');
                                }}
                                className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold border-b border-gray-100 dark:border-white/5 pb-1.5 mb-1"
                            >
                                <span>Insert Row Below</span>
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const rIdx = contextMenu.rowIndex;
                                    setContextMenu(null);
                                    const targetRow = sortedGridDataRef.current[rIdx];
                                    if (targetRow) handleDuplicateRow(targetRow);
                                }}
                                className="w-full text-left px-3.5 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300 flex items-center justify-between font-semibold"
                            >
                                <span>Duplicate Row</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const rIdx = contextMenu.rowIndex;
                                    setContextMenu(null);
                                    if (selectedIds.size > 0) {
                                        handleBulkDelete();
                                    } else {
                                        const targetRow = sortedGridDataRef.current[rIdx];
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

            {/* Smart Excel Import & Paste Right Sidebar Drawer */}
            <AnimatePresence>
                {isExcelModalOpen && (
                    <div className="fixed inset-0 z-[8500] overflow-hidden">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsExcelModalOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
                        />

                        {/* Slide-Over Right Drawer */}
                        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                                className="w-screen max-w-2xl bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/10 shadow-2xl flex flex-col justify-between overflow-hidden"
                            >
                                {/* Drawer Header */}
                                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-500/20">
                                            <FileSpreadsheet size={22} />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-bold text-gray-900 dark:text-white">Excel Import & Smart Paste</h2>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Import vendor files or paste cells directly with real-time preview</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsExcelModalOpen(false)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white transition cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Drawer Tab Navigation & Download Template Bar */}
                                <div className="px-6 pt-4 pb-3 border-b border-gray-100 dark:border-white/5 flex items-center justify-between gap-4 shrink-0 bg-white dark:bg-[#161b22]">
                                    <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold">
                                        <button
                                            type="button"
                                            onClick={() => setExcelModalTab('upload')}
                                            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition cursor-pointer ${excelModalTab === 'upload'
                                                ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                        >
                                            <UploadCloud size={14} />
                                            <span>Upload Spreadsheet</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExcelModalTab('paste')}
                                            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition cursor-pointer ${excelModalTab === 'paste'
                                                ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                        >
                                            <ClipboardPaste size={14} />
                                            <span>Paste from Excel</span>
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={downloadExcelTemplateFile}
                                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 cursor-pointer py-1"
                                        title="Download blank vendor spreadsheet template"
                                    >
                                        <Download size={13} />
                                        <span>Download Template (.xlsx)</span>
                                    </button>
                                </div>

                                {/* Drawer Body */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-5 table-scrollbar">
                                    {excelModalTab === 'upload' && (
                                        <div className="space-y-4">
                                            {/* Drag & Drop Upload Zone */}
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-gray-300 dark:border-white/20 hover:border-blue-500 dark:hover:border-blue-400 bg-gray-50/50 dark:bg-white/[0.01] hover:bg-blue-50/20 dark:hover:bg-blue-950/10 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center gap-2 group"
                                            >
                                                <div className="p-3 bg-blue-50 dark:bg-white/5 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-105 transition">
                                                    <UploadCloud size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                                        Click to browse or drop your spreadsheet here
                                                    </p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                                        Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) files
                                                    </p>
                                                </div>
                                                {excelSourceFileName && (
                                                    <div className="mt-1 px-3 py-1 bg-blue-100/70 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                                                        <FileSpreadsheet size={13} />
                                                        <span>{excelSourceFileName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {excelModalTab === 'paste' && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                                    <ClipboardPaste size={14} className="text-blue-600 dark:text-blue-400" />
                                                    <span>Paste copied cells from Excel / Google Sheets</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const text = await navigator.clipboard.readText();
                                                            if (text && text.trim()) {
                                                                setExcelPasteText(text);
                                                                const parsed = parseRawRowsToVendors(parseExcelClipboardText(text));
                                                                setExcelParsedVendors(parsed);
                                                                setExcelSourceFileName('Pasted from clipboard');
                                                            } else {
                                                                showToast('info', 'Clipboard Empty', 'No content found on your clipboard.');
                                                            }
                                                        } catch (e) {
                                                            showToast('error', 'Clipboard Access', 'Could not read clipboard. Please paste manually into the box below.');
                                                        }
                                                    }}
                                                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <ClipboardPaste size={12} />
                                                    <span>Paste from Clipboard</span>
                                                </button>
                                            </div>
                                            <textarea
                                                rows={5}
                                                value={excelPasteText}
                                                onChange={(e) => {
                                                    const text = e.target.value;
                                                    setExcelPasteText(text);
                                                    const parsed = parseRawRowsToVendors(parseExcelClipboardText(text));
                                                    setExcelParsedVendors(parsed);
                                                    setExcelSourceFileName(text.trim() ? 'Pasted text' : '');
                                                }}
                                                placeholder="Paste your copied rows here (Ctrl+V)... Header columns like 'Company Name', 'Category', 'Nature of Job', 'Contact Person', 'Contact No', 'Email ID' will be automatically mapped."
                                                className="w-full p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-y transition"
                                            />
                                        </div>
                                    )}

                                    {/* Live Data Preview Section */}
                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                    Live Parsed Data Preview
                                                </h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${excelParsedVendors.length > 0
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400 border-gray-200 dark:border-white/10'
                                                    }`}>
                                                    {excelParsedVendors.length} {excelParsedVendors.length === 1 ? 'Row' : 'Rows'}
                                                </span>
                                            </div>

                                            {excelParsedVendors.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setExcelParsedVendors([]);
                                                        setExcelPasteText('');
                                                        setExcelSourceFileName('');
                                                    }}
                                                    className="text-[11px] text-red-500 hover:text-red-600 font-bold hover:underline cursor-pointer"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>

                                        {excelParsedVendors.length === 0 ? (
                                            <div className="p-8 border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-center bg-gray-50/50 dark:bg-white/[0.01]">
                                                <FileText size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">No data parsed yet</p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">Upload a spreadsheet or paste rows to see a live preview of all mapped columns.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 table-scrollbar">
                                                {excelParsedVendors.map((item, idx) => (
                                                    <div
                                                        key={item.id || idx}
                                                        className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] shadow-xs space-y-2 text-xs"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="text-[10px] font-mono font-bold text-gray-400 shrink-0">#{idx + 1}</span>
                                                                <span className="font-bold text-gray-900 dark:text-white truncate">
                                                                    {item.name || <span className="text-red-500 italic">No Company Name</span>}
                                                                </span>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${CATEGORY_BADGE_STYLES[item.category] || CATEGORY_BADGE_STYLES.Other}`}>
                                                                {item.category || 'Contractor'}
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-2">
                                                            <div>
                                                                <span className="text-gray-400">Job: </span>
                                                                <span className="font-semibold text-blue-600 dark:text-blue-400">{item.job_name || '—'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Contact: </span>
                                                                <span className="font-medium text-gray-700 dark:text-gray-300">{item.contact_person || '—'}</span>
                                                                {item.designation && <span className="text-gray-400"> ({item.designation})</span>}
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Phone: </span>
                                                                <span className="font-mono text-gray-700 dark:text-gray-300">{item.telephone_no || '—'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-400">Email: </span>
                                                                <span className="font-mono text-gray-700 dark:text-gray-300 truncate">{item.email || '—'}</span>
                                                            </div>
                                                        </div>

                                                        {(item.address || item.location || item.remarks) && (
                                                            <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.02] p-2 rounded-lg border border-gray-100 dark:border-white/5 space-y-0.5">
                                                                {(item.address || item.location) && (
                                                                    <p className="truncate">
                                                                        <span className="text-gray-400">Address / Location: </span>
                                                                        {[item.address, item.location].filter(Boolean).join(', ')}
                                                                    </p>
                                                                )}
                                                                {item.remarks && (
                                                                    <p className="truncate">
                                                                        <span className="text-gray-400">Remarks: </span>
                                                                        {item.remarks}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Drawer Footer */}
                                <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-[#161b22] flex items-center justify-between gap-4 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Import Mode:</label>
                                        <select
                                            value={excelImportMode}
                                            onChange={(e) => setExcelImportMode(e.target.value)}
                                            className="px-2.5 py-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
                                        >
                                            <option value="append">Append to list</option>
                                            <option value="replace">Replace all existing</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsExcelModalOpen(false)}
                                            className="px-4 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCommitExcelImport}
                                            disabled={excelParsedVendors.length === 0}
                                            className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${excelParsedVendors.length > 0
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-95 cursor-pointer'
                                                : 'bg-gray-200 dark:bg-white/10 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            <CheckCircle size={14} />
                                            <span>Add to Vendors ({excelParsedVendors.length})</span>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Hidden File Input for Excel / CSV */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
            />

            {/* ── Job Nature Portal Dropdown ── */}
            {dropdownPortalProps && dropdownPortalProps.colName === 'job_name' && (
                <SearchableDropdownPortal
                    coords={{ top: dropdownPortalProps.top, left: dropdownPortalProps.left, width: 280 }}
                    items={allJobNatures}
                    getLabel={(j) => j.job_name || ''}
                    getKey={(j, idx) => j.job_id || j.job_name || idx}
                    selectedValue={vendors[dropdownPortalProps.rowIndex]?.job_name || ''}
                    placeholder="Search or enter job nature..."
                    allowCreate={true}
                    createLabel="Add"
                    onSelect={(selected) => {
                        const name = typeof selected === 'object' ? selected.job_name : selected;
                        handleCellChange(dropdownPortalProps.rowIndex, 'job_name', name, true);
                        setDropdownPortalProps(null);
                        setJobNatureSearch('');
                    }}
                    onCreate={(val) => {
                        handleCellChange(dropdownPortalProps.rowIndex, 'job_name', val, true);
                        setDropdownPortalProps(null);
                        setJobNatureSearch('');
                    }}
                    onClose={() => {
                        setDropdownPortalProps(null);
                        setJobNatureSearch('');
                    }}
                />
            )}
        </>
    );
};

export default VendorsList;
