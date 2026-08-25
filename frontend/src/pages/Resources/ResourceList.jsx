import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
    Search, Plus, Trash2, Info, RefreshCw, Package, Layers, Users, X, Upload,
    Download, Save, RotateCcw, AlertCircle, ChevronDown, ChevronRight, Copy, Eye, CheckSquare,
    Square, ArrowUpDown, ArrowUp, ArrowDown, Filter, Sparkles, Check, DollarSign, ArrowLeftRight, Scale, Edit3,
    UploadCloud, ClipboardPaste, FileSpreadsheet, FileText, CheckCircle
} from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import ResourceDetail from './ResourceDetail';
import ResourceForm from './ResourceForm';
import ResourceRecipesTab from './ResourceRecipesTab';
import ResourceRatesTab from './ResourceRatesTab';
import ResourceConversionsTab from './ResourceConversionsTab';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { UNIT_REGISTRY, UNIT_OPTIONS, UNIT_GROUPS } from './resourceConstants';
import ConfirmModal from '../../components/ConfirmModal';
import DuplicateResolverModal from '../../components/DuplicateResolverModal';
import Toast from '../../components/Toast';
import ResourceFilterDropdown from './ResourceFilterDropdown';
import CustomDatePicker from '../../components/CustomDatePicker';

const COLUMN_ALIASES = {
    code: ['code', 'item code', 'resource code', 'material code', 'sku', 'product code', 'item no', 'item_code'],
    name: ['resource name', 'name', 'item name', 'material name', 'item description', 'description / name', 'product name', 'title'],
    type: ['type', 'resource type', 'category', 'item type', 'classification'],
    base_unit_code: ['base unit', 'unit', 'uom', 'unit of measure', 'unit code', 'measure', 'base unit code'],
    rate: ['rate', 'standard rate', 'unit rate', 'price', 'unit price', 'cost', 'standard rate (₹)', 'rate (₹)', 'rate (rs)'],
    description: ['description', 'specification', 'spec', 'details', 'item details', 'desc'],
    remarks: ['remarks', 'notes', 'comments', 'remark', 'note']
};

const matchColumnHeader = (headerText) => {
    if (!headerText || typeof headerText !== 'string') return null;
    const clean = headerText.trim().toLowerCase().replace(/[*_#₹()]/g, '').replace(/\s+/g, ' ');
    for (const [colKey, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (aliases.some(a => clean === a || clean.startsWith(a) || a.startsWith(clean))) {
            return colKey;
        }
    }
    return null;
};

const downloadExcelTemplateFile = () => {
    const headers = [
        'Resource Code',
        'Resource Name',
        'Type (Material/Item/Labour)',
        'Base Unit (kg/nos/cum/sqm/ltr/etc)',
        'Rate (₹)',
        'Description',
        'Remarks'
    ];
    const data = [headers];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 18 },
        { wch: 32 },
        { wch: 25 },
        { wch: 28 },
        { wch: 18 },
        { wch: 35 },
        { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resources');
    XLSX.writeFile(wb, 'Resources_Template.xlsx');
};

const TYPE_CONFIG = {
    material: { label: 'Material', icon: Package, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    item: { label: 'Item', icon: Layers, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    labour: { label: 'Labour', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
};

const unitTypeLabel = { weight: 'Weight', volume: 'Volume', length: 'Length', area: 'Area', count: 'Count', time: 'Time' };
const today = () => new Date().toISOString().slice(0, 10);

const GRID_COLUMNS = ['code', 'name', 'type', 'base_unit_code', 'rate', 'compositions', 'conversions', 'description', 'remarks'];
const DEFAULT_GRID_COLUMNS = ['code', 'name', 'type', 'base_unit_code', 'rate', 'description', 'remarks'];

const COLUMN_METADATA = [
    { key: 'code', label: 'Code', default: true },
    { key: 'name', label: 'Name', default: true, required: true },
    { key: 'type', label: 'Type', default: true },
    { key: 'base_unit_code', label: 'Base Unit', default: true },
    { key: 'rate', label: 'Rate (₹)', default: true },
    { key: 'compositions', label: 'Recipe / Components', default: false },
    { key: 'conversions', label: 'Unit Conversions', default: false },
    { key: 'description', label: 'Description', default: true },
    { key: 'remarks', label: 'Remarks', default: true },
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
        } else if (!insideQuotes && (char === '\n' || char === '\r')) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }

    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }

    return rows.filter(r => r.length > 0 && r.some(c => c !== ''));
};

const parseNumericRate = (rawVal) => {
    if (rawVal === null || rawVal === undefined) return null;
    if (typeof rawVal === 'number') return isNaN(rawVal) ? null : rawVal;
    let clean = String(rawVal).replace(/[^0-9.-]/g, '').trim();
    if (!clean) return null;
    const num = parseFloat(clean);
    return isNaN(num) ? null : parseFloat(num.toFixed(2));
};

const resolveType = (rawStr) => {
    if (!rawStr) return 'material';
    const cleaned = rawStr.trim().toLowerCase();
    if (['material', 'item', 'labour'].includes(cleaned)) return cleaned;
    if (cleaned === 'composite' || cleaned === 'items' || cleaned === 'finished') return 'item';
    if (cleaned === 'materials' || cleaned === 'mat') return 'material';
    if (cleaned === 'labor' || cleaned === 'manpower' || cleaned === 'service') return 'labour';
    return 'material';
};

const resolveUnitCode = (rawStr) => {
    if (!rawStr) return 'kg';
    const cleaned = rawStr.trim().toLowerCase();
    if (UNIT_REGISTRY[cleaned]) return cleaned;

    const ALIAS_MAP = {
        'kgs': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
        'nos': 'nos', 'no': 'nos', 'numbers': 'nos', 'number': 'nos', 'pcs': 'nos', 'pc': 'nos', 'piece': 'nos', 'pieces': 'nos', 'units': 'nos', 'unit': 'nos',
        'sqft': 'sqft', 'sq.ft': 'sqft', 'sq ft': 'sqft', 'square feet': 'sqft', 'sqfeet': 'sqft', 'sft': 'sqft',
        'cum': 'cum', 'cu.m': 'cum', 'cu m': 'cum', 'cubic meter': 'cum', 'cubic meters': 'cum', 'm3': 'cum',
        'sqm': 'sqm', 'sq.m': 'sqm', 'sq m': 'sqm', 'square meter': 'sqm', 'square meters': 'sqm', 'm2': 'sqm',
        'm': 'm', 'mtr': 'm', 'meter': 'm', 'meters': 'm', 'rm': 'm', 'r.m': 'm',
        'ton': 'ton', 'tons': 'ton', 'tonne': 'ton', 'tonnes': 'ton', 'mt': 'ton',
        'bag': 'bag', 'bags': 'bag',
        'ltr': 'ltr', 'litre': 'ltr', 'litres': 'ltr', 'liter': 'ltr', 'liters': 'ltr', 'l': 'ltr',
        'hr': 'hr', 'hrs': 'hr', 'hour': 'hr', 'hours': 'hr',
        'day': 'day', 'days': 'day',
        'pkt': 'pkt', 'packet': 'pkt', 'packets': 'pkt', 'pkts': 'pkt',
        'box': 'box', 'boxes': 'box',
        'bundle': 'bundle', 'bundles': 'bundle',
        'set': 'set', 'sets': 'set',
        'trip': 'trip', 'trips': 'trip',
        'load': 'load', 'loads': 'load',
        'coil': 'coil', 'coils': 'coil',
        'roll': 'roll', 'rolls': 'roll'
    };

    if (ALIAS_MAP[cleaned]) return ALIAS_MAP[cleaned];

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

const COLUMN_WIDTH_CLASSES = {
    code: 'w-32 min-w-32 max-w-32',
    name: 'w-60 min-w-56',
    type: 'w-32 min-w-32 max-w-32',
    base_unit_code: 'w-36 min-w-36 max-w-36',
    rate: 'w-44 min-w-44 max-w-44',
    compositions: 'w-64 min-w-64 max-w-64',
    conversions: 'w-56 min-w-56 max-w-56',
    description: 'w-56 min-w-48',
    remarks: 'w-56 min-w-48'
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

const ResourceSubNav = ({ activeTab, onChange }) => {
    const tabs = [
        { id: 'grid', label: 'Resource Grid' },
        { id: 'recipes', label: 'Recipes & History' },
        { id: 'rates', label: 'Rates' },
        { id: 'conversions', label: 'Conversions' }
    ];

    return (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-[#161b22]/70 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

const ResourceList = () => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);

    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'grid';
    const targetResourceId = searchParams.get('resourceId') || '';

    // Cache visited tabs so their DOM and state are preserved when switching tabs
    const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab]));

    useEffect(() => {
        setVisitedTabs(prev => {
            if (prev.has(activeTab)) return prev;
            const next = new Set(prev);
            next.add(activeTab);
            return next;
        });
    }, [activeTab]);

    const setActiveTab = (tab, resId = null) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', tab);
        if (resId) params.set('resourceId', String(resId));
        else params.delete('resourceId');
        setSearchParams(params);
    };

    const [isAddFormOpen, setIsAddFormOpen] = useState(false);

    // Ref to container for click outside detection
    const tableContainerRef = useRef(null);

    // Helper to get initial cached state from sessionStorage
    const getInitialDraftState = () => {
        try {
            sessionStorage.removeItem('mano_resources_draft_grid');
            sessionStorage.removeItem('mano_resources_draft_deleted');
        } catch (e) { }

        let cached = [];
        try {
            const cachedStr = sessionStorage.getItem('mano_resources_cache');
            if (cachedStr) cached = JSON.parse(cachedStr);
        } catch (e) { }

        return {
            draftGrid: Array.isArray(cached) ? cached.map(r => ({ ...r, _status: 'saved', _errors: {} })) : [],
            draftDeleted: new Set()
        };
    };

    const initialDraft = getInitialDraftState();

    // Original list from server
    const [resources, setResources] = useState(() => initialDraft.draftGrid.filter(r => r._status === 'saved'));
    const resourcesRef = useRef(resources);
    resourcesRef.current = resources;

    // Spreadsheet grid state
    const [gridData, setGridData] = useState(() => initialDraft.draftGrid);
    const gridDataRef = useRef(gridData);
    gridDataRef.current = gridData;

    // Deleted IDs tracking for manual save
    const [deletedIds, setDeletedIds] = useState(initialDraft.draftDeleted);
    const deletedIdsRef = useRef(deletedIds);
    deletedIdsRef.current = deletedIds;

    // Original database data map for dirty comparison
    const originalResourcesMap = useMemo(() => {
        const map = new Map();
        resources.forEach(r => {
            if (r && r.id) map.set(r.id, r);
        });
        return map;
    }, [resources]);

    // Check if a resource row differs from its original database record
    const isResourceRowDirty = (row, originalResource) => {
        if (!row) return false;
        if (!originalResource) {
            // New row: dirty only if explicitly new and user has entered required name & base_unit_code
            return row._status === 'new' && Boolean(row.name && row.name.trim() && row.base_unit_code);
        }
        if (row._status === 'new') {
            return Boolean(row.name && row.name.trim() && row.base_unit_code);
        }

        // Basic string fields
        if (String(row.code ?? '').trim() !== String(originalResource.code ?? '').trim()) return true;
        if (String(row.name ?? '').trim() !== String(originalResource.name ?? '').trim()) return true;
        if ((row.type || 'material') !== (originalResource.type || 'material')) return true;
        if (String(row.base_unit_code ?? '').trim() !== String(originalResource.base_unit_code ?? '').trim()) return true;
        if (String(row.description ?? '').trim() !== String(originalResource.description ?? '').trim()) return true;
        if (String(row.remarks ?? '').trim() !== String(originalResource.remarks ?? '').trim()) return true;

        // Rate comparison
        const curRate = parseNumericRate(row.rate);
        const origRate = parseNumericRate(originalResource.rate);
        if (curRate !== origRate) return true;

        // Compositions comparison
        const curComp = Array.isArray(row.compositions) ? row.compositions : [];
        const origComp = Array.isArray(originalResource.compositions) ? originalResource.compositions : [];
        if (curComp.length !== origComp.length) return true;
        for (let i = 0; i < curComp.length; i++) {
            const c = curComp[i];
            const o = origComp[i];
            if (
                String(c.component_resource_id) !== String(o.component_resource_id) ||
                Number(c.quantity) !== Number(o.quantity) ||
                String(c.unit_code || '') !== String(o.unit_code || '')
            ) return true;
        }

        // Conversions comparison
        const curConv = Array.isArray(row.conversions) ? row.conversions : [];
        const origConv = Array.isArray(originalResource.conversions) ? originalResource.conversions : [];
        if (curConv.length !== origConv.length) return true;
        for (let i = 0; i < curConv.length; i++) {
            const c = curConv[i];
            const o = origConv[i];
            if (
                String(c.name || '').trim() !== String(o.name || '').trim() ||
                Number(c.quantity) !== Number(o.quantity) ||
                String(c.unit_code || '') !== String(o.unit_code || '')
            ) return true;
        }

        return false;
    };

    const { hasUnsavedChanges, unsavedCount } = useMemo(() => {
        if (deletedIds.size === 0 && gridData.length === resources.length && gridData.every(r => r._status === 'saved' && !r._compositionModified && !r._rateModified)) {
            return { hasUnsavedChanges: false, unsavedCount: 0 };
        }
        let dirtyCount = 0;
        for (let i = 0; i < gridData.length; i++) {
            const row = gridData[i];
            if (row._status === 'new') {
                if (row.name && row.name.trim()) dirtyCount++;
            } else if (row._status === 'modified' || row._status === 'error' || row._compositionModified || row._rateModified) {
                const original = originalResourcesMap.get(row.id);
                if (isResourceRowDirty(row, original)) dirtyCount++;
            }
        }
        const total = dirtyCount + deletedIds.size;
        return { hasUnsavedChanges: total > 0, unsavedCount: total };
    }, [gridData, originalResourcesMap, deletedIds, resources.length]);

    const hasPendingCompositionChanges = useMemo(() => gridData.some(row => {
        if (row._compositionModified) return true;
        const original = originalResourcesMap.get(row.id);
        if (!original) return row._status === 'new' && (row.compositions || []).length > 0;
        const curComp = Array.isArray(row.compositions) ? row.compositions : [];
        const origComp = Array.isArray(original.compositions) ? original.compositions : [];
        if (curComp.length !== origComp.length) return true;
        return curComp.some((c, i) => {
            const o = origComp[i];
            return String(c.component_resource_id) !== String(o.component_resource_id) ||
                Number(c.quantity) !== Number(o.quantity) ||
                String(c.unit_code || '') !== String(o.unit_code || '');
        });
    }), [gridData, originalResourcesMap]);

    const hasPendingRateChanges = useMemo(() => gridData.some(row => {
        if (row._rateModified) return true;
        const original = originalResourcesMap.get(row.id);
        if (!original) return row._status === 'new' && row.rate !== null && row.rate !== undefined && row.rate !== '';
        return parseNumericRate(row.rate) !== parseNumericRate(original.rate);
    }), [gridData, originalResourcesMap]);

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

    const [isLoading, setIsLoading] = useState(() => initialDraft.draftGrid.length === 0);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [compositionEffectiveFrom, setCompositionEffectiveFrom] = useState(today());
    const [rateEffectiveFrom, setRateEffectiveFrom] = useState(today());

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');

    // Column Visibility Privilege & Selection State
    const getInitialVisibleColumns = () => {
        try {
            const saved = localStorage.getItem('mano_resource_grid_columns_v2');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const requiredKeys = COLUMN_METADATA.filter(c => c.required).map(c => c.key);
                    return Array.from(new Set([...parsed, ...requiredKeys]));
                }
            }
        } catch (e) { }
        return DEFAULT_GRID_COLUMNS;
    };

    const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns);
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
    const columnSelectorRef = useRef(null);

    // Save column preferences to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('mano_resource_grid_columns_v2', JSON.stringify(visibleColumns));
        } catch (e) { }
    }, [visibleColumns]);

    // Click outside handler for Column Selector & Excel Dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (columnSelectorRef.current && !columnSelectorRef.current.contains(e.target)) {
                setIsColumnSelectorOpen(false);
            }
            if (excelDropdownRef.current && !excelDropdownRef.current.contains(e.target)) {
                setIsExcelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeGridColumns = useMemo(() => {
        return GRID_COLUMNS.filter(colKey => {
            if (!visibleColumns.includes(colKey)) return false;
            if (filterType === 'material' && colKey === 'compositions') return false;
            if (filterType === 'labour' && (colKey === 'compositions' || colKey === 'conversions')) return false;
            return true;
        });
    }, [visibleColumns, filterType]);

    const toggleColumnVisibility = (colKey) => {
        const meta = COLUMN_METADATA.find(c => c.key === colKey);
        if (meta?.required) return; // Necessary columns cannot be disabled
        setVisibleColumns(prev => {
            if (prev.includes(colKey)) {
                if (prev.length <= 1) return prev;
                return prev.filter(c => c !== colKey);
            } else {
                return [...prev, colKey];
            }
        });
    };


    const resetDefaultColumns = () => setVisibleColumns(DEFAULT_GRID_COLUMNS);
    const selectAllColumns = () => setVisibleColumns(GRID_COLUMNS);

    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [filterUnitSearch, setFilterUnitSearch] = useState('');
    const [activeFilters, setActiveFilters] = useState({ types: [], units: [], statuses: [] });
    const filterDropdownRef = useRef(null);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    // Excel Tools & Right Sidebar Drawer State
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [isExcelDropdownOpen, setIsExcelDropdownOpen] = useState(false);
    const excelDropdownRef = useRef(null);
    const [isManageDropdownOpen, setIsManageDropdownOpen] = useState(false);
    const manageDropdownRef = useRef(null);
    const fileInputRef = useRef(null);
    const [excelPasteText, setExcelPasteText] = useState('');
    const [excelParsedResources, setExcelParsedResources] = useState([]);
    const [excelSourceFileName, setExcelSourceFileName] = useState('');
    const [excelImportMode, setExcelImportMode] = useState('append'); // 'append' | 'replace'
    const [excelModalTab, setExcelModalTab] = useState('upload'); // 'upload' | 'paste'

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [lastSelectedId, setLastSelectedId] = useState(null);

    // Sorting state (default null key so editing rows does not shift rows above/below)
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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

    // Refs for always-fresh access in event callbacks (avoids stale closures)
    const selectionAnchorRef = useRef(null);
    selectionAnchorRef.current = selectionAnchor;
    const selectionFocusRef = useRef(null);
    selectionFocusRef.current = selectionFocus;
    const selectedIdsRef = useRef(new Set());
    selectedIdsRef.current = selectedIds;

    // Internal clipboard buffer for cut/copy/paste between cells
    const internalClipboardRef = useRef('');

    // Always-fresh ref to executePaste â€” avoids stale closure in useEffect event handlers
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

    // Expandable Row Details State (Inline Sub-sheet View)
    const [expandedRowIds, setExpandedRowIds] = useState(new Set());

    const toggleExpandRow = (id) => {
        setExpandedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Sub-row inline addition forms state
    const [newCompForm, setNewCompForm] = useState({ component_resource_id: '', quantity: '1', unit_code: 'kg' });
    const [newConvForm, setNewConvForm] = useState({ name: '', quantity: '1', unit_code: 'kg' });

    // Inline composition modifier
    const handleAddInlineComposition = (resourceId, componentResId, qty, unitCode) => {
        pushUndoState(gridDataRef.current);
        setGridData(prev => {
            return prev.map(row => {
                if (row.id === resourceId) {
                    const compRes = resourcesRef.current.find(r => String(r.id) === String(componentResId));
                    const newComp = {
                        id: `temp_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                        component_resource_id: Number(componentResId),
                        component_name: compRes ? compRes.name : `Component #${componentResId}`,
                        component_code: compRes ? compRes.code : '',
                        quantity: Number(qty) || 1,
                        unit_code: unitCode || (compRes ? compRes.base_unit_code : 'kg')
                    };
                    const existing = row.compositions || [];
                    const updatedComps = [...existing, newComp];
                    return {
                        ...row,
                        compositions: updatedComps,
                        _compositionModified: true,
                        _status: row._status === 'new' ? 'new' : 'modified'
                    };
                }
                return row;
            });
        });
        showToast('sparkle', 'Recipe Ingredient Added', 'Component added to item recipe in spreadsheet.');
    };

    const handleDeleteInlineComposition = (resourceId, compId) => {
        const targetRow = gridDataRef.current.find(r => r.id === resourceId);
        const compItem = targetRow?.compositions?.find(c => String(c.id) === String(compId));
        const compName = compItem?.component_name || 'ingredient';
        setConfirmModal({
            isOpen: true,
            title: 'Remove Recipe Ingredient?',
            message: `Are you sure you want to remove component "${compName}" from the item recipe?`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                pushUndoState(gridDataRef.current);
                setGridData(prev => {
                    return prev.map(row => {
                        if (row.id === resourceId) {
                            const updatedComps = (row.compositions || []).filter(c => String(c.id) !== String(compId));
                            return {
                                ...row,
                                compositions: updatedComps,
                                _compositionModified: true,
                                _status: row._status === 'new' ? 'new' : 'modified'
                            };
                        }
                        return row;
                    });
                });
                showToast('info', 'Ingredient Removed', 'Removed component from recipe.');
                closeConfirmModal();
            }
        });
    };

    // Inline conversion modifier
    const handleAddInlineConversion = (resourceId, name, qty, unitCode) => {
        if (!name || !name.trim()) {
            showToast('error', 'Invalid Scale Name', 'Please enter a scale name (e.g., Box, Pack, Container).');
            return;
        }
        pushUndoState(gridDataRef.current);
        setGridData(prev => {
            return prev.map(row => {
                if (row.id === resourceId) {
                    const newConv = {
                        id: `temp_conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                        name: name.trim(),
                        quantity: Number(qty) || 1,
                        unit_code: unitCode
                    };
                    const existing = row.conversions || [];
                    const updatedConvs = [...existing, newConv];
                    return {
                        ...row,
                        conversions: updatedConvs,
                        _status: row._status === 'new' ? 'new' : 'modified'
                    };
                }
                return row;
            });
        });
        showToast('sparkle', 'Conversion Scale Added', `Added scale "${name}".`);
    };

    const handleDeleteInlineConversion = (resourceId, convId) => {
        const targetRow = gridDataRef.current.find(r => r.id === resourceId);
        const convItem = targetRow?.conversions?.find(c => String(c.id) === String(convId));
        const scaleName = convItem?.name || 'conversion scale';
        setConfirmModal({
            isOpen: true,
            title: 'Remove Conversion Scale?',
            message: `Are you sure you want to remove unit conversion scale "${scaleName}"?`,
            confirmText: 'Remove Scale',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                pushUndoState(gridDataRef.current);
                setGridData(prev => {
                    return prev.map(row => {
                        if (row.id === resourceId) {
                            const updatedConvs = (row.conversions || []).filter(c => String(c.id) !== String(convId));
                            return {
                                ...row,
                                conversions: updatedConvs,
                                _status: row._status === 'new' ? 'new' : 'modified'
                            };
                        }
                        return row;
                    });
                });
                showToast('info', 'Conversion Removed', 'Removed conversion scale.');
                closeConfirmModal();
            }
        });
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
            if (excelDropdownRef.current && !excelDropdownRef.current.contains(e.target)) {
                setIsExcelDropdownOpen(false);
            }
            if (manageDropdownRef.current && !manageDropdownRef.current.contains(e.target)) {
                setIsManageDropdownOpen(false);
            }
            if (e.target.closest('.z-\\[6000\\]') || e.target.closest('.z-\\[9999\\]') || e.target.closest('.z-\\[9000\\]') || e.target.closest('.z-\\[7000\\]') || e.target.closest('[data-context-menu="true"]') || e.target.closest('[role="dialog"]')) {
                return;
            }
            if (!e.target.closest('td[id^="cell-"]')) {
                setSelectionAnchor(null);
                setSelectionFocus(null);
                setEditingCell(null);
                closeDropdown();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // High-performance viewport scroll & auto-focus engine (0ms reflow overhead)
    useEffect(() => {
        if (selectionFocus && sortedGridDataRef.current && sortedGridDataRef.current[selectionFocus.r]) {
            const colName = activeGridColumns[selectionFocus.c];
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

    // Reactive bounds for JSX rendering (context menu visibility, etc.)
    const bounds = useMemo(() => {
        if (!selectionAnchor) return null;
        const focus = selectionFocus || selectionAnchor;
        return {
            minRow: Math.min(selectionAnchor.r, focus.r),
            maxRow: Math.max(selectionAnchor.r, focus.r),
            minCol: Math.min(selectionAnchor.c, focus.c),
            maxCol: Math.max(selectionAnchor.c, focus.c),
        };
    }, [selectionAnchor, selectionFocus]);

    // Stats
    const stats = useMemo(() => {
        const activeRows = gridData.filter(r => !deletedIds.has(r.id));
        return {
            total: activeRows.length,
            materials: activeRows.filter(r => (r.type || 'material') === 'material').length,
            items: activeRows.filter(r => r.type === 'item').length,
            labour: activeRows.filter(r => r.type === 'labour').length,
        };
    }, [gridData, deletedIds]);

    const fetchData = async (isManualRefresh = false) => {
        if (resourcesRef.current.length === 0 || isManualRefresh) {
            setIsLoading(true);
        }
        try {
            const resData = await resourceApi.getResources();
            const fetchedList = resData.resources || [];

            try {
                sessionStorage.setItem('mano_resources_cache', JSON.stringify(fetchedList));
            } catch (e) { }

            setResources(fetchedList);

            setGridData(prevGrid => {
                const newUnsaved = prevGrid.filter(r => String(r.id).startsWith('temp_') && r._status === 'new');
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
    const prepareResourcePayload = (row) => {
        const {
            _status,
            _errors,
            _compositionModified,
            _rateModified,
            base_unit_name,
            base_unit_symbol,
            ...payload
        } = row;

        const original = originalResourcesMap.get(row.id);
        const rateChanged = !original || (parseNumericRate(row.rate) !== parseNumericRate(original.rate));
        const compChanged = !original || (() => {
            const curComp = Array.isArray(row.compositions) ? row.compositions : [];
            const origComp = Array.isArray(original.compositions) ? original.compositions : [];
            if (curComp.length !== origComp.length) return true;
            return curComp.some((c, i) => {
                const o = origComp[i];
                return String(c.component_resource_id) !== String(o.component_resource_id) ||
                    Number(c.quantity) !== Number(o.quantity) ||
                    String(c.unit_code || '') !== String(o.unit_code || '');
            });
        })();

        if (_compositionModified || compChanged) {
            payload.compositions = (row.compositions || [])
                .filter(comp => comp.component_resource_id && Number(comp.quantity) > 0 && comp.unit_code)
                .map(comp => ({
                    component_resource_id: Number(comp.component_resource_id),
                    quantity: Number(comp.quantity),
                    unit_code: comp.unit_code
                }));
            payload.effective_from = compositionEffectiveFrom;
        } else {
            delete payload.compositions;
            delete payload.effective_from;
        }

        if (_rateModified || rateChanged) {
            payload.rate = row.rate;
            payload.rate_unit_code = row.rate_unit_code || row.base_unit_code;
            payload.rate_effective_from = rateEffectiveFrom;
            payload.rate_remarks = row.remarks || null;
        } else {
            delete payload.rate;
            delete payload.rate_source;
            delete payload.rate_unit_code;
            delete payload.rate_effective_from;
            delete payload.rate_remarks;
        }

        return payload;
    };

    // ─── Manual Batch Save Engine ──────────────────────────────────────────────
    const saveGridRows = async () => {
        const targetGrid = gridDataRef.current;
        const dirtyRows = targetGrid.filter(r => {
            const original = originalResourcesMap.get(r.id);
            return isResourceRowDirty(r, original);
        });
        const newRows = dirtyRows.filter(r => (!originalResourcesMap.has(r.id) || r._status === 'new') && r.name && r.name.trim() && r.base_unit_code);
        const modifiedRows = dirtyRows.filter(r => originalResourcesMap.has(r.id) && r._status !== 'new' && r.name && r.name.trim() && r.base_unit_code);
        const pendingDeleteIds = Array.from(deletedIds);

        if (newRows.length === 0 && modifiedRows.length === 0 && pendingDeleteIds.length === 0) {
            showToast('info', 'No Changes', 'There are no unsaved changes to save.');
            return;
        }

        setIsSaving(true);
        try {
            if (pendingDeleteIds.length > 0) {
                await Promise.all(pendingDeleteIds.map(id => resourceApi.deleteResource(id)));
                setDeletedIds(new Set());
            }

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

            let insertedIds = [];
            if (newPayloadRows.length > 0) {
                const cleanPayload = newPayloadRows.map(row => {
                    const payload = prepareResourcePayload(row);
                    delete payload.id;
                    return payload;
                });
                const res = await resourceApi.bulkCreateResources(cleanPayload);
                // Backend returns { success, report: { successCount, insertedIds, errors } }
                insertedIds = res?.report?.insertedIds || res?.insertedIds || [];
            }

            if (validModifiedRows.length > 0) {
                const cleanPayload = validModifiedRows.map(prepareResourcePayload);
                await resourceApi.bulkUpdateResources(cleanPayload);
            }

            // Build a map from temp IDs → real server IDs
            const tempToRealIdMap = new Map();
            newPayloadRows.forEach((nr, i) => {
                if (insertedIds[i]) tempToRealIdMap.set(nr.id, insertedIds[i]);
            });

            // Re-fetch from server to get authoritative data (with codes, rates, etc.)
            try {
                const resData = await resourceApi.getResources();
                const fetchedList = resData.resources || [];

                try {
                    sessionStorage.setItem('mano_resources_cache', JSON.stringify(fetchedList));
                } catch (e) { }

                // Clear session draft since save succeeded
                try {
                    sessionStorage.removeItem('mano_resources_draft_grid');
                    sessionStorage.removeItem('mano_resources_draft_deleted');
                } catch (e) { }

                setResources(fetchedList);

                // Rebuild grid from server data, preserving any remaining unsaved rows
                setGridData(prevGrid => {
                    // Keep only temp rows that were NOT part of this save
                    const savedTempIds = new Set(newPayloadRows.map(r => r.id));
                    const remainingUnsaved = prevGrid.filter(
                        r => String(r.id).startsWith('temp_') && !savedTempIds.has(r.id)
                    );

                    const serverGrid = fetchedList.map(fetched => ({
                        ...fetched,
                        _status: 'saved',
                        _errors: {},
                        _compositionModified: false,
                        _rateModified: false
                    }));

                    return [...serverGrid, ...remainingUnsaved];
                });
            } catch (refetchErr) {
                // If re-fetch fails, do best-effort local update
                console.warn('Post-save re-fetch failed, updating locally', refetchErr);
                setGridData(prevGrid => {
                    return prevGrid.map(row => {
                        if (validModifiedRows.some(m => m.id === row.id)) {
                            return { ...row, _status: 'saved', _errors: {}, _compositionModified: false, _rateModified: false };
                        }
                        if (tempToRealIdMap.has(row.id)) {
                            return {
                                ...row,
                                id: tempToRealIdMap.get(row.id),
                                _status: 'saved',
                                _errors: {},
                                _compositionModified: false,
                                _rateModified: false
                            };
                        }
                        return row;
                    });
                });
                setResources(prev => {
                    const updated = prev.filter(r => !pendingDeleteIds.includes(r.id));
                    return updated;
                });
            }

            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setLastSavedTime(timeStr);
            showToast('success', 'Changes Saved', 'All changes have been successfully saved to database & cloud.');
        } catch (err) {
            console.error('Failed to save resource grid', err);
            const userFriendlyMsg = formatBackendError(err);
            showToast('error', 'Save Error', userFriendlyMsg, 5000);
        } finally {
            setIsSaving(false);
        }
    };

    // Sorting & Filtering local grid data (Memoized, high-performance)
    const filteredGridData = useMemo(() => {
        const hasSearch = Boolean(searchTerm && searchTerm.trim());
        const hasTypes = activeFilters.types.length > 0;
        const hasUnits = activeFilters.units.length > 0;
        const hasStatuses = activeFilters.statuses.length > 0;

        if (!hasSearch && !filterType && !hasTypes && !hasUnits && !hasStatuses) {
            return gridData;
        }

        const lowerSearch = hasSearch ? searchTerm.toLowerCase().trim() : '';
        const typeSet = hasTypes ? new Set(activeFilters.types) : null;
        const unitSet = hasUnits ? new Set(activeFilters.units) : null;
        const statusSet = hasStatuses ? new Set(activeFilters.statuses) : null;

        return gridData.filter(r => {
            if (filterType && r.type !== filterType) return false;
            if (typeSet && !typeSet.has(r.type)) return false;
            if (unitSet && !unitSet.has(r.base_unit_code)) return false;
            if (statusSet && !statusSet.has(r._status || 'saved')) return false;

            if (lowerSearch) {
                const name = r.name ? r.name.toLowerCase() : '';
                const code = r.code ? r.code.toLowerCase() : '';
                const desc = r.description ? r.description.toLowerCase() : '';
                const rem = r.remarks ? r.remarks.toLowerCase() : '';
                return name.includes(lowerSearch) || code.includes(lowerSearch) || desc.includes(lowerSearch) || rem.includes(lowerSearch);
            }
            return true;
        });
    }, [gridData, searchTerm, filterType, activeFilters]);

    // Stable Grid Data (prevents live re-sorting on every keypress so rows above & below remain unaffected)
    const sortedGridData = useMemo(() => {
        return filteredGridData;
    }, [filteredGridData]);

    const sortedGridDataRef = useRef(sortedGridData);
    sortedGridDataRef.current = sortedGridData;

    // Pagination States & Memoization
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(100); // Options: 50, 100, 250, 500, 1000, 'All'

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType, activeFilters, pageSize]);

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

    // Custom Context Menu & Excel Fill Operations
    const [contextMenu, setContextMenu] = useState(null); // { x: number, y: number, rowIndex: number, colIndex: number }

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

    useEffect(() => {
        const handleCloseMenu = () => setContextMenu(null);
        window.addEventListener('click', handleCloseMenu);
        return () => window.removeEventListener('click', handleCloseMenu);
    }, []);

    // Fill Down (Ctrl+D)
    const handleFillDown = () => {
        const bounds = getSelectionBounds();
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
                const col = activeGridColumns[c];
                if (col !== 'code') {
                    rowCopy[col] = sourceRowObj[col];
                }
            }
            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
            updatedGrid[realIdx] = rowCopy;
        }

        setGridData(updatedGrid);
        showToast('sparkle', 'Fill Down (Ctrl+D)', `Filled values down across ${bounds.maxRow - bounds.minRow + 1} rows.`);
    };

    // Fill Right (Ctrl+R)
    const handleFillRight = () => {
        const bounds = getSelectionBounds();
        if (!bounds || bounds.minCol === bounds.maxCol || !canWrite) return;
        pushUndoState(gridDataRef.current);

        let updatedGrid = [...gridDataRef.current];

        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const targetRowObj = sortedGridDataRef.current[r];
            if (!targetRowObj) continue;
            const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
            if (realIdx === -1) continue;

            const sourceColName = activeGridColumns[bounds.minCol];
            const fillVal = targetRowObj[sourceColName];

            const rowCopy = { ...updatedGrid[realIdx] };
            for (let c = bounds.minCol + 1; c <= bounds.maxCol; c++) {
                const col = activeGridColumns[c];
                if (col !== 'code') {
                    rowCopy[col] = fillVal;
                }
            }
            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
            updatedGrid[realIdx] = rowCopy;
        }

        setGridData(updatedGrid);
        showToast('sparkle', 'Fill Right (Ctrl+R)', `Filled values right across columns.`);
    };

    // Auto-Fill Down (Double-Click Fill Handle)
    const handleAutoFillDown = () => {
        const bounds = getSelectionBounds();
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
                const col = activeGridColumns[c];
                if (col !== 'code') {
                    rowCopy[col] = sourceRowObj[col];
                }
            }
            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
            updatedGrid[realIdx] = rowCopy;
        }

        setGridData(updatedGrid);
        setSelectionFocus({ r: totalRows - 1, c: bounds.maxCol });
        showToast('sparkle', 'Auto-Fill Down', `Auto-filled values down to bottom of table (${totalRows} rows).`);
    };

    // Cancel Changes Handler
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
                    sessionStorage.removeItem('mano_resources_draft_grid');
                    sessionStorage.removeItem('mano_resources_draft_deleted');
                } catch (e) { }

                const savedList = resourcesRef.current.map(r => ({ ...r, _status: 'saved', _errors: {} }));
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

    // Insert Row Above / Below
    const handleInsertRow = (targetRowIndex, position = 'below') => {
        pushUndoState(gridDataRef.current);
        const insertIdx = position === 'above' ? targetRowIndex : targetRowIndex + 1;
        const newRow = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            code: '',
            name: '',
            type: 'material',
            base_unit_code: 'kg',
            description: '',
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

    // ─── Global Keyboard Shortcuts ───────────────────────────────────────────
    useEffect(() => {
        const handleGlobalShortcuts = (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifier = isMac ? e.metaKey : e.ctrlKey;
            const activeEl = document.activeElement;
            const activeTag = activeEl?.tagName?.toLowerCase();
            const isEditingText = activeTag === 'input' || activeTag === 'textarea';

            // Escape always works regardless of focus
            if (e.key === 'Escape') {
                setEditingCell(null);
                setSelectionAnchor(null);
                setSelectionFocus(null);
                setSelectedIds(new Set());
                closeDropdown();
                return;
            }

            // Ctrl+V / Cmd+V : Paste — always let the native 'paste' event fire.
            // We handle the actual paste in the window 'paste' event (handleNativePaste).
            // Do NOT block or preventDefault here — just return to let the event propagate.
            if (modifier && (e.key === 'v' || e.key === 'V')) {
                // Only if a cell or row is selected — otherwise let browser handle naturally.
                const hasSel = selectedIdsRef.current.size > 0 || selectionAnchorRef.current !== null;
                if (hasSel && canWrite) {
                    // Do NOT call preventDefault — the browser must fire the 'paste' event
                    // so handleNativePaste gets e.clipboardData synchronously.
                    return;
                }
                // No cell selected — allow native behaviour (e.g. paste into a regular input).
                return;
            }

            // For all other shortcuts: if a text input is focused and the user is
            // actively editing (not just navigating), skip the spreadsheet shortcuts.
            if (isEditingText) return;

            // Delete or Backspace key : clear selected cells / delete selected rows
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (canWrite) {
                    const bounds = getSelectionBounds();
                    if (selectedIds.size > 0) {
                        e.preventDefault();
                        handleBulkDelete();
                        return;
                    } else if (bounds) {
                        e.preventDefault();
                        const totalCols = activeGridColumns.length;
                        const isFullRowSelected = (bounds.minCol === 0 && bounds.maxCol === totalCols - 1);
                        if (isFullRowSelected) {
                            const rowsToDelete = [];
                            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                                const targetRowObj = sortedGridDataRef.current[r];
                                if (targetRowObj) rowsToDelete.push(targetRowObj);
                            }
                            if (rowsToDelete.length > 0) requestDeleteRowEntries(rowsToDelete);
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
                                    rowCopy[activeGridColumns[c]] = '';
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

            // Alt+N : Add New Row
            if (e.altKey && (e.key === 'n' || e.key === 'N')) {
                if (canWrite) { e.preventDefault(); handleAddRows(1); return; }
            }

            // Ctrl+A : Select All
            if (modifier && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
                if (sortedGridDataRef.current.length > 0) {
                    setSelectionAnchor({ r: 0, c: 0 });
                    setSelectionFocus({ r: sortedGridDataRef.current.length - 1, c: activeGridColumns.length - 1 });
                    setSelectedIds(new Set(sortedGridDataRef.current.map(r => r.id)));
                    showToast('info', 'Selected All', `Selected all ${sortedGridDataRef.current.length} row(s) and cells.`);
                }
                return;
            }

            // Ctrl+D : Fill Down
            if (modifier && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault(); handleFillDown(); return;
            }

            // Ctrl+R : Fill Right
            if (modifier && (e.key === 'r' || e.key === 'R')) {
                e.preventDefault(); handleFillRight(); return;
            }

            // Ctrl+Z : Undo
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

            // Ctrl+Y / Ctrl+Shift+Z : Redo
            if ((modifier && (e.key === 'y' || e.key === 'Y')) || (modifier && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
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

            // Ctrl+C : Copy
            if (modifier && (e.key === 'c' || e.key === 'C')) {
                const hasSel = selectedIdsRef.current.size > 0 || selectionAnchorRef.current !== null;
                if (hasSel) { e.preventDefault(); executeCopy(); }
                return;
            }

            // Ctrl+X : Cut
            if (modifier && (e.key === 'x' || e.key === 'X')) {
                if (canWrite) {
                    const hasSel = selectedIdsRef.current.size > 0 || selectionAnchorRef.current !== null;
                    if (hasSel) { e.preventDefault(); executeCut(); }
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleGlobalShortcuts);
        return () => window.removeEventListener('keydown', handleGlobalShortcuts);
    }, [canWrite]);

    // â”€â”€â”€ Cell Copy (Ctrl+C), Cut (Ctrl+X), & Paste (Ctrl+V) Core Functions â”€â”€â”€â”€â”€
    const executeCopy = () => {
        let rowsToCopy = [];
        let minCol = 0;
        let maxCol = activeGridColumns.length - 1;

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

        if (rowsToCopy.length === 0) return null;

        const tsvLines = rowsToCopy.map(rowObj => {
            const rowVals = [];
            for (let c = minCol; c <= maxCol; c++) {
                const colName = activeGridColumns[c];
                rowVals.push(rowObj[colName] ?? '');
            }
            return rowVals.join('\t');
        });

        const tsvData = tsvLines.join('\n');
        if (tsvData.trim()) {
            internalClipboardRef.current = tsvData;
            navigator.clipboard?.writeText(tsvData).catch(() => {});
            const numCells = tsvLines.length * (maxCol - minCol + 1);
            showToast('sparkle', '', numCells === 1 ? 'Copied 1 cell to clipboard' : `Copied ${numCells} cells to clipboard`);
        }
        return tsvData;
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
                const col = activeGridColumns[c];
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

        const totalCols = activeGridColumns.length;
        const isFullRowSelected = (bounds.minCol === 0 && bounds.maxCol === totalCols - 1);

        if (isFullRowSelected) {
            // Duplicate entire selected row(s) right below selection
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
                    code: generateUniqueCode(row.code || 'RES', gridDataRef.current),
                    name: row.name ? `${row.name} (Copy)` : 'Copy',
                    type: row.type || 'material',
                    base_unit_code: row.base_unit_code || 'kg',
                    rate: row.rate !== undefined ? row.rate : null,
                    description: row.description || '',
                    remarks: row.remarks || '',
                    compositions: row.compositions ? JSON.parse(JSON.stringify(row.compositions)) : [],
                    conversions: row.conversions ? JSON.parse(JSON.stringify(row.conversions)) : [],
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
                                const colName = activeGridColumns[c];
                                if (colName !== 'code') {
                                    rowCopy[colName] = sourceRowObj[colName] ?? '';
                                    numCellsFilled++;
                                }
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
                            const colName = activeGridColumns[c];
                            if (colName !== 'code') {
                                rowCopy[colName] = sourceRowObj[colName] ?? '';
                                numCellsFilled++;
                            }
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

    const parseRawRowsToResources = (rawRows) => {
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
                    code: '',
                    name: '',
                    type: 'material',
                    base_unit_code: 'kg',
                    rate: null,
                    description: '',
                    remarks: '',
                    compositions: [],
                    conversions: [],
                    _status: 'new',
                    _errors: {}
                };

                row.forEach((cellVal, cIdx) => {
                    const val = String(cellVal ?? '').trim();
                    const targetCol = headerRowIdx !== -1 ? colMap[cIdx] : GRID_COLUMNS[cIdx];
                    if (targetCol) {
                        if (targetCol === 'type') {
                            item.type = resolveType(val);
                        } else if (targetCol === 'base_unit_code') {
                            item.base_unit_code = resolveUnitCode(val);
                        } else if (targetCol === 'rate') {
                            item.rate = parseNumericRate(val);
                            item.rate_source = 'manual';
                        } else if (targetCol === 'code' && val) {
                            item.code = val;
                        } else if (targetCol === 'name') {
                            item.name = val;
                        } else if (targetCol === 'description') {
                            item.description = val;
                        } else if (targetCol === 'remarks') {
                            item.remarks = val;
                        }
                    }
                });

                if (!item.name) {
                    const firstNonEmpty = row.find(c => String(c || '').trim() !== '');
                    if (firstNonEmpty) item.name = String(firstNonEmpty).trim();
                }

                if (!item.code) {
                    item.code = generateUniqueCode('RES', parsedList);
                }

                if (item.name) {
                    parsedList.push(item);
                }
            });
        } else {
            rawRows.forEach((r, rIdx) => {
                const item = {
                    id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${rIdx}`,
                    code: '',
                    name: '',
                    type: 'material',
                    base_unit_code: 'kg',
                    rate: null,
                    description: '',
                    remarks: '',
                    compositions: [],
                    conversions: [],
                    _status: 'new',
                    _errors: {}
                };

                Object.entries(r).forEach(([key, val]) => {
                    const cleanVal = String(val ?? '').trim();
                    const targetCol = matchColumnHeader(key) || (GRID_COLUMNS.includes(key) ? key : null);
                    if (targetCol) {
                        if (targetCol === 'type') {
                            item.type = resolveType(cleanVal);
                        } else if (targetCol === 'base_unit_code') {
                            item.base_unit_code = resolveUnitCode(cleanVal);
                        } else if (targetCol === 'rate') {
                            item.rate = parseNumericRate(cleanVal);
                            item.rate_source = 'manual';
                        } else if (targetCol === 'code' && cleanVal) {
                            item.code = cleanVal;
                        } else if (targetCol === 'name') {
                            item.name = cleanVal;
                        } else if (targetCol === 'description') {
                            item.description = cleanVal;
                        } else if (targetCol === 'remarks') {
                            item.remarks = cleanVal;
                        }
                    }
                });

                if (!item.name) {
                    const fallbackName = r['Resource Name'] || r['Item Name'] || r['Material Name'] || r['Name'] || r['name'] || '';
                    if (fallbackName) item.name = String(fallbackName).trim();
                }

                if (!item.code) {
                    item.code = generateUniqueCode('RES', parsedList);
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
                    const parsed = parseRawRowsToResources(rawAoa);
                    setExcelParsedResources(parsed);
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
                    const parsed = parseRawRowsToResources(results.data);
                    setExcelParsedResources(parsed);
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
        if (!excelParsedResources || excelParsedResources.length === 0) {
            showToast('info', 'No Rows', 'No valid resource rows to import.');
            return;
        }

        pushUndoState(gridDataRef.current);

        if (excelImportMode === 'append') {
            setGridData(prev => [...excelParsedResources, ...prev]);
        } else {
            setGridData(excelParsedResources);
        }

        setIsExcelModalOpen(false);
        setExcelParsedResources([]);
        setExcelPasteText('');
        showToast('sparkle', 'Resources Imported', `Successfully imported ${excelParsedResources.length} resource row(s). Click "Save Changes" to save to database.`);
    };

    const executePaste = (pastedDataText, forcedStartRow, forcedStartCol) => {
        let textToPaste = pastedDataText || internalClipboardRef.current;
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
                const parsedRes = parseRawRowsToResources(parsedRows);
                if (parsedRes.length > 0) {
                    pushUndoState(gridDataRef.current);
                    setGridData(prev => [...parsedRes, ...prev]);
                    showToast('sparkle', 'Pasted Resources', `Mapped & added ${parsedRes.length} resource row(s) from Excel.`);
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
                        if (c < activeGridColumns.length) {
                            const colName = activeGridColumns[c];
                            if (colName !== 'compositions' && colName !== 'conversions') {
                                let cleanVal = (cellVal ?? '').trim();
                                if (colName === 'type') {
                                    cleanVal = resolveType(cleanVal);
                                } else if (colName === 'base_unit_code') {
                                    cleanVal = resolveUnitCode(cleanVal);
                                } else if (colName === 'rate') {
                                    cleanVal = parseNumericRate(cleanVal);
                                    rowCopy.rate_source = 'manual';
                                }
                                rowCopy[colName] = cleanVal;
                                numCellsUpdated++;
                            }
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
                    code: generateUniqueCode('RES', updatedGrid),
                    name: '',
                    type: 'material',
                    base_unit_code: 'kg',
                    rate: null,
                    description: '',
                    remarks: '',
                    compositions: [],
                    conversions: [],
                    _status: 'new',
                    _errors: {}
                };
                cells.forEach((cellVal, dc) => {
                    const c = startCol + dc;
                    if (c < activeGridColumns.length) {
                        const colName = activeGridColumns[c];
                        if (colName !== 'compositions' && colName !== 'conversions') {
                            let cleanVal = (cellVal ?? '').trim();
                            if (colName === 'type') {
                                cleanVal = resolveType(cleanVal);
                            } else if (colName === 'base_unit_code') {
                                cleanVal = resolveUnitCode(cleanVal);
                            } else if (colName === 'rate') {
                                cleanVal = parseNumericRate(cleanVal);
                                newRow.rate_source = 'manual';
                            } else if (colName === 'code' && cleanVal) {
                                newRow.code = cleanVal;
                            }
                            if (colName !== 'code' || cleanVal) {
                                newRow[colName] = cleanVal;
                            }
                            numCellsUpdated++;
                        }
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
            const endCol = Math.min(startCol + (expandedRows[0]?.length || 1) - 1, activeGridColumns.length - 1);
            setSelectionAnchor({ r: startRow, c: startCol });
            setSelectionFocus({ r: endRow, c: endCol });

            if (newRowsAddedCount > 0) {
                showToast('sparkle', '', `Pasted ${numCellsUpdated} cell${numCellsUpdated > 1 ? 's' : ''} (${newRowsAddedCount} new row${newRowsAddedCount > 1 ? 's' : ''})`);
            } else {
                showToast('sparkle', '', numCellsUpdated === 1 ? 'Pasted 1 cell successfully' : `Pasted ${numCellsUpdated} cells successfully`);
            }
        }
    };
    executePasteRef.current = executePaste;


    // ─── Native Browser Copy/Paste event handlers (fires when focus is NOT on an input) ─
    useEffect(() => {
        const handleNativeCopy = (e) => {
            const activeEl = document.activeElement;
            const activeTag = activeEl?.tagName?.toLowerCase();
            if ((activeTag === 'input' || activeTag === 'textarea') &&
                activeEl.selectionStart !== activeEl.selectionEnd) {
                return;
            }
            const curSelectedIds = selectedIdsRef.current;
            const anchor = selectionAnchorRef.current;
            if (curSelectedIds.size === 0 && !anchor) return;

            const bounds = getBoundsFromRefs();
            let rowsToCopy = [];
            let minCol = 0;
            let maxCol = activeGridColumns.length - 1;

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
                    rowVals.push(rowObj[activeGridColumns[c]] ?? '');
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
            // is multi-cell (contains tabs or newlines) â€” i.e. it's from Excel/Sheets.
            const isMultiCell = pastedData.includes('\t') || pastedData.includes('\n');

            if (isInInput && !isMultiCell) return;

            // Require at least a cell or row to be selected
            if (!selectionAnchorRef.current && selectedIdsRef.current.size === 0) return;

            e.preventDefault();
            // Use ref to avoid stale closure â€” always calls the latest executePaste
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
        const nextDirection = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
        setSortConfig({ key, direction: nextDirection });

        pushUndoState(gridDataRef.current);
        setGridData(prevGrid => {
            const savedRows = prevGrid.filter(r => !String(r.id).startsWith('temp_') && r._status !== 'new');
            const newRows = prevGrid.filter(r => String(r.id).startsWith('temp_') || r._status === 'new');

            savedRows.sort((a, b) => {
                let aVal = a[key] || '';
                let bVal = b[key] || '';
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                if (aVal < bVal) return nextDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return nextDirection === 'asc' ? 1 : -1;
                return 0;
            });

            return [...savedRows, ...newRows];
        });
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
                    c: activeGridColumns.length - 1
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
                    setSelectionFocus({ r: maxR, c: 0 });
                }
            } else {
                setSelectionAnchor(null);
                setSelectionFocus(null);
            }

            return next;
        });
        setLastSelectedId(id);
    };

    // ─── Cell Management with Immediate Auto-Save & Undo Push ─────────────────
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

            if (field === 'rate') {
                row._rateModified = true;
            }

            if (field === 'type' && value !== 'item') {
                row.compositions = [];
            }

            if (field === 'base_unit_code' && row._status !== 'new' && row.base_unit_code) {
                const oldType = UNIT_REGISTRY[row.base_unit_code]?.type;
                const newType = UNIT_REGISTRY[value]?.type;
                if (oldType && newType && oldType !== newType) {
                    showToast('error', 'Incompatible Unit Category', `Cannot change from ${oldType.toUpperCase()} (${row.base_unit_code}) to ${newType.toUpperCase()} (${value}). Unit changes must stay within the same category (e.g. g to kg, MT) to protect rates and recipes.`);
                    return prev;
                }
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
            const original = originalResourcesMap.get(row.id);
            if (Object.keys(errors).length === 0) {
                delete row._errors;
                if (!original || row._status === 'new') {
                    row._status = 'new';
                } else {
                    const isDirty = isResourceRowDirty(row, original);
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
        showToast('success', 'Entry Deleted', `Deleted ${rowsToDelete.length} resource entry(ies) locally. Click "Save Changes" to apply.`);

        if (savedIds.length > 0) {
            setDeletedIds(prev => new Set([...prev, ...savedIds]));
        }
    };

    const requestDeleteRowEntries = (rowsToDelete) => {
        if (!rowsToDelete || rowsToDelete.length === 0) return;
        const count = rowsToDelete.length;
        setConfirmModal({
            isOpen: true,
            title: count === 1 ? 'Delete Selected Resource Entry?' : `Delete ${count} Selected Resource Entries?`,
            message: count === 1
                ? `Are you sure you want to delete "${rowsToDelete[0].name || 'Selected Entry'}" locally? Click "Save Changes" after deletion to apply to cloud.`
                : `Are you sure you want to delete ${count} selected row entry(ies) locally? Click "Save Changes" after deletion to apply to cloud.`,
            confirmText: `Delete (${count})`,
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                deleteSelectedRowEntries(rowsToDelete);
                closeConfirmModal();
            }
        });
    };

    // ─── Spreadsheet Keyboard Navigation & Range Operations ───────────────────
    const handleCellKeyDown = (e, rowIndex, colName) => {
        const colIndex = activeGridColumns.indexOf(colName);
        const totalRows = sortedGridData.length;
        const totalCols = activeGridColumns.length;
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
                        requestDeleteRowEntries(rowsToDelete);
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
                        const col = activeGridColumns[c];
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
                if (colName === 'type' || colName === 'base_unit_code') {
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
            if (colName !== 'type' && colName !== 'base_unit_code') {
                cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                setEditingCell({ rowIndex: curFocus.r, colName });
                handleCellChange(curFocus.r, colName, e.key);
            }
        }
    };

    // â”€â”€â”€ Add Row(s) (inserted right below active cursor) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleAddRows = (count = 1) => {
        pushUndoState(gridDataRef.current);
        const { gridInsertIdx, sortedRowIdx } = getTargetInsertIndex();

        const newRows = Array.from({ length: count }).map((_, idx) => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${idx}`,
            code: '',
            name: '',
            type: 'material',
            base_unit_code: 'kg',
            description: '',
            remarks: '',
            compositions: [],
            conversions: [],
            _status: 'new',
            _errors: {}
        }));

        setGridData(prev => {
            const next = [...prev];
            next.splice(gridInsertIdx, 0, ...newRows);
            return next;
        });

        // Compute which page the inserted row is on and auto-navigate
        const targetPage = pageSize !== 'All' ? Math.floor(sortedRowIdx / Number(pageSize)) + 1 : 1;
        if (pageSize !== 'All' && targetPage !== currentPage) {
            setCurrentPage(targetPage);
            showToast('info', 'Rows Added', `Added ${count} new resource row(s) on Page ${targetPage} (Row ${sortedRowIdx + 1}).`);
        } else {
            showToast('info', 'Rows Added', `Added ${count} new resource row(s) below selection.`);
        }

        setSelectionAnchor({ r: sortedRowIdx, c: 0 });
        setSelectionFocus({ r: sortedRowIdx + count - 1, c: 0 });
    };

    // â”€â”€â”€ Duplicate Row (inserted right below duplicated row) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleDuplicateRow = (targetRow) => {
        let row = targetRow;
        if (!row) {
            const bounds = getBoundsFromRefs();
            if (bounds && sortedGridDataRef.current[bounds.minRow]) {
                row = sortedGridDataRef.current[bounds.minRow];
            }
        }
        if (!row) {
            showToast('info', 'Duplicate Row', 'Please select a cell or row to duplicate.');
            return;
        }

        pushUndoState(gridDataRef.current);
        const duplicate = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${Math.floor(Math.random() * 1000)}`,
            code: row.code ? generateUniqueCode(row.code, gridDataRef.current) : '',
            name: row.name ? `${row.name} (Copy)` : 'New Copy',
            type: row.type || 'material',
            base_unit_code: row.base_unit_code || 'kg',
            description: row.description || '',
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
            showToast('sparkle', 'Row Duplicated', `Duplicated "${row.name || 'resource'}" to Page ${targetPage} (Row ${sortedIdx + 1}).`);
        } else {
            showToast('sparkle', 'Row Duplicated', `Duplicated "${row.name || 'resource'}" right below.`);
        }

        setSelectionAnchor({ r: sortedIdx, c: 0 });
        setSelectionFocus({ r: sortedIdx, c: 0 });
    };

    // Remove Duplicate Resources Modal Handler
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
            setResources(prev => prev.filter(r => !savedRemovedIds.includes(r.id)));
        }

        showToast('success', 'Duplicates Removed', `Removed ${idsToDelete.length} selected duplicate resource(s) locally. Click "Save Changes" to apply.`);
    };

    // â”€â”€â”€ Bulk Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;

        setConfirmModal({
            isOpen: true,
            title: 'Delete Selected Resources?',
            message: `Are you sure you want to delete ${selectedIds.size} selected resource(s)? Click "Save Changes" after deletion to apply to cloud.`,
            confirmText: `Delete (${selectedIds.size})`,
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                pushUndoState(gridDataRef.current);
                const idsToDelete = Array.from(selectedIds);
                const savedIds = idsToDelete.filter(id => !String(id).startsWith('temp_'));
                const count = selectedIds.size;

                setResources(prev => prev.filter(r => !selectedIds.has(r.id)));
                setGridData(prev => prev.filter(r => !selectedIds.has(r.id)));
                setSelectedIds(new Set());
                if (viewingResource && selectedIds.has(viewingResource)) {
                    setViewingResource(null);
                }
                closeConfirmModal();
                showToast('success', 'Bulk Delete Successful', `Deleted ${count} selected resource(s) locally. Click "Save Changes" to apply.`);

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
            code: row.code ? generateUniqueCode(row.code, gridDataRef.current) : '',
            name: row.name ? `${row.name} (Copy)` : 'Copy',
            type: row.type || 'material',
            base_unit_code: row.base_unit_code || 'kg',
            description: row.description || '',
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

    const handleBulkChangeType = (newType) => {
        if (selectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);
        const count = selectedIds.size;
        setGridData(prev => prev.map(row => {
            if (selectedIds.has(row.id)) {
                return {
                    ...row,
                    type: newType,
                    compositions: newType !== 'item' ? [] : row.compositions,
                    _status: row._status === 'new' ? 'new' : 'modified'
                };
            }
            return row;
        }));
        closeDropdown();
        showToast('sparkle', 'Type Updated', `Changed type to "${newType.toUpperCase()}" for ${count} row(s). Click "Save Changes" to apply.`);
    };

    const handleBulkChangeUnit = (newUnit) => {
        if (selectedIds.size === 0) return;
        const newUnitType = UNIT_REGISTRY[newUnit]?.type;
        
        // Validate category compatibility
        const incompatibleRows = gridDataRef.current.filter(row => {
            if (!selectedIds.has(row.id) || row._status === 'new' || !row.base_unit_code) return false;
            const curType = UNIT_REGISTRY[row.base_unit_code]?.type;
            return curType && newUnitType && curType !== newUnitType;
        });

        if (incompatibleRows.length > 0) {
            closeDropdown();
            showToast(
                'error',
                'Incompatible Unit Category',
                `Cannot change ${incompatibleRows.length} resource(s) to "${newUnit}" (${newUnitType?.toUpperCase()}). Unit changes must stay within the same measurement category (e.g., grams to kilograms).`
            );
            return;
        }

        pushUndoState(gridDataRef.current);
        const count = selectedIds.size;
        const u = UNIT_REGISTRY[newUnit];
        const unitName = u ? u.name : newUnit;

        setGridData(prev => prev.map(row => {
            if (selectedIds.has(row.id)) {
                return {
                    ...row,
                    base_unit_code: newUnit,
                    _status: row._status === 'new' ? 'new' : 'modified'
                };
            }
            return row;
        }));
        closeDropdown();
        showToast('sparkle', 'Unit Updated', `Changed base unit to "${unitName}" for ${count} row(s). Click "Save Changes" to apply.`);
    };

    // â”€â”€â”€ Delete Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            message: `Are you sure you want to delete "${row.name || 'this resource'}"? Click "Save Changes" after deletion to apply to cloud.`,
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
                showToast('success', 'Resource Deleted', `Deleted "${row.name || 'Resource'}" locally. Click "Save Changes" to apply.`);
                if (!String(row.id).startsWith('temp_')) {
                    setDeletedIds(prev => new Set([...prev, row.id]));
                }
            }
        });
    };

    // â”€â”€â”€ Export CSV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleExportCSV = () => {
        const headers = ['Code', 'Name', 'Type', 'Base Unit', 'Effective Rate (INR)', 'Rate Source', 'Recipe Breakdown', 'Unit Conversions', 'Description', 'Remarks'];
        const csvRows = sortedGridData.map(r => {
            const recipeStr = (r.compositions || []).map(c => `${c.component_name || 'Component'} (${c.quantity} ${c.unit_code})`).join(' + ');
            const convStr = (r.conversions || []).map(c => `1 ${c.name} = ${c.quantity} ${c.unit_code}`).join('; ');
            const rateStr = r.rate !== null && r.rate !== undefined ? String(r.rate) : '';
            return [
                r.code || '',
                r.name || '',
                r.type || '',
                r.base_unit_code || '',
                rateStr,
                r.rate_source || 'manual',
                recipeStr,
                convStr,
                r.description || '',
                r.remarks || ''
            ];
        });

        const csvString = [
            headers.join(','),
            ...csvRows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `mano_resources_excel_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('success', 'Excel Export Complete', `Exported ${sortedGridData.length} resources with full rates, recipes & conversion details.`);
    };


    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full relative">

            <ResourceSubNav
                activeTab={activeTab}
                onChange={tab => setActiveTab(tab, targetResourceId || null)}
            />

            {/* Cached Tab: Recipes & History */}
            {visitedTabs.has('recipes') && (
                <div className={`flex-1 min-h-0 overflow-hidden ${activeTab === 'recipes' ? 'flex flex-col' : 'hidden'}`}>
                    <ResourceRecipesTab
                        initialResourceId={targetResourceId}
                        resources={resources}
                        onRefreshResources={() => fetchData(true)}
                        showToast={showToast}
                    />
                </div>
            )}

            {/* Cached Tab: Rates */}
            {visitedTabs.has('rates') && (
                <div className={`flex-1 min-h-0 overflow-hidden ${activeTab === 'rates' ? 'flex flex-col' : 'hidden'}`}>
                    <ResourceRatesTab
                        initialResourceId={targetResourceId}
                        resources={resources}
                        onRefreshResources={() => fetchData(true)}
                        showToast={showToast}
                    />
                </div>
            )}

            {/* Cached Tab: Conversions */}
            {visitedTabs.has('conversions') && (
                <div className={`flex-1 min-h-0 overflow-hidden ${activeTab === 'conversions' ? 'flex flex-col' : 'hidden'}`}>
                    <ResourceConversionsTab
                        initialResourceId={targetResourceId}
                        resources={resources}
                        onRefreshResources={() => fetchData(true)}
                        showToast={showToast}
                    />
                </div>
            )}

            {/* Tab: Resource Grid */}
            <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${activeTab === 'grid' ? '' : 'hidden'}`}>
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
            <div className="px-3 pt-2 pb-2 border-b border-gray-200 dark:border-white/5 shrink-0 bg-gray-50/50 dark:bg-[#161b22]/30">
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { id: 'total', label: 'Total Resources', value: stats.total, color: 'text-gray-900 dark:text-white', bg: 'bg-white dark:bg-white/[0.03]' },
                        { id: 'materials', label: 'Materials', value: stats.materials, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/50 dark:bg-amber-900/10' },
                        { id: 'items', label: 'Items', value: stats.items, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50/50 dark:bg-purple-900/10' },
                        { id: 'labour', label: 'Labour', value: stats.labour, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
                    ].map((s) => (
                        <div key={s.id} className={`${s.bg} rounded-lg p-2 px-3 border border-gray-200/60 dark:border-white/5`}>
                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                            <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Toolbar - Save Changes, Search Bar, Add Resource, Refresh & Actions */}
            <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-200 dark:border-white/5 shrink-0 gap-3">
                <div className="flex items-center gap-3">
                    {hasPendingCompositionChanges && (
                        <div className="flex items-center gap-1.5 border border-purple-200 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg px-2 py-1">
                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300 uppercase whitespace-nowrap">Recipe effective:</span>
                            <CustomDatePicker
                                value={compositionEffectiveFrom}
                                onChange={e => setCompositionEffectiveFrom(e.target.value)}
                                className="w-[150px]"
                            />
                        </div>
                    )}
                    {hasPendingRateChanges && (
                        <div className="flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg px-2 py-1">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 uppercase whitespace-nowrap">Rate effective:</span>
                            <CustomDatePicker
                                value={rateEffectiveFrom}
                                onChange={e => setRateEffectiveFrom(e.target.value)}
                                className="w-[150px]"
                            />
                        </div>
                    )}
                    {/* Manual Save Button & Sync Status */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => saveGridRows()}
                            disabled={isSaving || !hasUnsavedChanges}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${isSaving
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

                <div className="flex items-center gap-2.5 shrink-0">
                    {/* Search Bar */}
                    <div className="relative w-44">
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
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${filterType === opt.value
                                    ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Filter Dropdown Popup */}
                    <ResourceFilterDropdown
                        activeFilters={activeFilters}
                        onApply={(newFilters) => setActiveFilters(newFilters)}
                    />

                    {/* Column Visibility Selector Dropdown */}
                    <div className="relative" ref={columnSelectorRef}>
                        <button
                            type="button"
                            onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${visibleColumns.length < GRID_COLUMNS.length
                                ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                }`}
                            title="Customize Grid Columns Visibility"
                        >
                            <Eye size={13} />
                            <span>Columns</span>
                            <span className="ml-0.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                {visibleColumns.length}/{GRID_COLUMNS.length}
                            </span>
                            <ChevronDown size={12} className={`transition-transform duration-200 ${isColumnSelectorOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isColumnSelectorOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[6000] p-3 text-xs text-gray-800 dark:text-gray-200 flex flex-col gap-2 select-none animate-in fade-in zoom-in-95 duration-100">
                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2">
                                    <span className="font-extrabold uppercase text-[10px] tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                        <Eye size={12} /> Visible Columns
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllColumns}
                                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-gray-300 dark:text-white/10">â€¢</span>
                                        <button
                                            type="button"
                                            onClick={resetDefaultColumns}
                                            className="text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1 max-h-72 overflow-y-auto no-scrollbar pr-0">
                                    {COLUMN_METADATA.map(col => {
                                        const isVisible = visibleColumns.includes(col.key);
                                        const isRequired = col.required;
                                        return (
                                            <div
                                                key={col.key}
                                                onClick={() => !isRequired && toggleColumnVisibility(col.key)}
                                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition cursor-pointer ${isRequired ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-white/[0.02]' : 'hover:bg-gray-100 dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                <span className="font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                                                    <CustomCheckbox
                                                        checked={isVisible}
                                                        onChange={() => !isRequired && toggleColumnVisibility(col.key)}
                                                    />
                                                    <span>{col.label}</span>
                                                </span>
                                                {isRequired && (
                                                    <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 uppercase bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                                                        Required
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </div>


                    {/* Remove Duplicates button */}
                    <button
                        onClick={handleRemoveDuplicates}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer"
                        title="Instantly find and remove duplicate rows"
                    >
                        <Copy size={13} />
                        <span>Remove Duplicates</span>
                    </button>

                    {/* Minimal Import & Excel Dropdown */}
                    {canWrite && (
                        <div className="relative inline-block shrink-0" ref={excelDropdownRef}>
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

                    {/* Export CSV button */}
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-800 border border-gray-250 dark:text-gray-400 dark:hover:text-white dark:border-white/10 bg-transparent rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition shrink-0 cursor-pointer"
                        title="Export CSV"
                    >
                        <Download size={13} />
                        <span>Export CSV</span>
                    </button>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={() => fetchData(true)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
                        title="Refresh resource list from server"
                    >
                        <RefreshCw size={13} className={isLoading ? "animate-spin text-blue-500" : ""} />
                        <span>Refresh</span>
                    </button>

                    {/* Add Resource Button */}
                    {canWrite && (
                        <div className="relative group shrink-0">
                            <button
                                type="button"
                                onClick={() => handleAddRows(1)}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                                title="Add new editable resource row directly to Excel grid"
                            >
                                <Plus size={14} className="stroke-[3]" />
                                <span>Add Resource</span>
                            </button>
                            <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-xl py-1 text-xs w-28 font-semibold">
                                <button onClick={() => handleAddRows(5)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 cursor-pointer">Add 5 Rows</button>
                                <button onClick={() => handleAddRows(10)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 cursor-pointer">Add 10 Rows</button>
                            </div>
                        </div>
                    )}

                    {/* Manage Dropdown */}
                    {canWrite && (
                        <div className="relative shrink-0" ref={manageDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsManageDropdownOpen(!isManageDropdownOpen)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                                <span>Manage</span>
                                <ChevronDown size={13} className={`transition-transform duration-200 ${isManageDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isManageDropdownOpen && (
                                <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#161b22] rounded-xl shadow-xl border border-gray-200 dark:border-white/10 z-[5000] overflow-hidden py-1.5 text-xs font-semibold select-none flex flex-col">
                                    <button
                                        type="button"
                                        onClick={() => { setIsAddFormOpen(true); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-3.5 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                    >
                                        <Plus size={14} className="mr-2 text-emerald-500" />
                                        Add Manual Resource
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { navigate('/resources/bulk-upload'); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-3.5 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                    >
                                        <UploadCloud size={14} className="mr-2 text-blue-500" />
                                        Bulk Upload CSV/Excel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { handleRemoveDuplicates(); setIsManageDropdownOpen(false); }}
                                        className="w-full flex items-center px-3.5 py-2 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-white/5 transition-colors border-t border-gray-100 dark:border-white/5 cursor-pointer"
                                    >
                                        <Copy size={14} className="mr-2 text-amber-500" />
                                        Remove Duplicates
                                    </button>
                                </div>
                            )}
                        </div>
                    )}



                </div>
            </div>

            {/* Excel Floating Bulk Actions Toaster Dock */}
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[6500] bg-gray-900/95 dark:bg-[#161b22]/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-gray-700/60 dark:border-white/15 flex items-center gap-3.5 select-none"
                    >
                        <div className="flex items-center gap-2 pr-2 border-r border-gray-700/80 dark:border-white/10 font-semibold text-xs">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white font-black text-[11px]">
                                {selectedIds.size}
                            </span>
                            <span className="text-gray-200">Selected</span>
                        </div>

                        {canWrite && (
                            <div className="flex items-center gap-2 relative">
                                <button
                                    onClick={handleBulkDuplicate}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition active:scale-95"
                                    title="Duplicate selected rows"
                                >
                                    <Copy size={13} />
                                    <span>Duplicate ({selectedIds.size})</span>
                                </button>

                                {/* Bulk Change Type Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            setShowBulkTypeMenu(v => !v);
                                            setShowBulkUnitMenu(false);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition active:scale-95"
                                    >
                                        <span>Change Type</span>
                                        <ChevronDown size={12} />
                                    </button>
                                    {showBulkTypeMenu && (
                                        <div className="absolute right-0 bottom-full mb-2 w-44 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-xl z-[6600] py-1 text-xs text-gray-800 dark:text-gray-200 font-medium no-scrollbar">
                                            {['material', 'item', 'labour'].map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => handleBulkChangeType(type)}
                                                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 capitalize font-semibold"
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Bulk Change Unit Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            setShowBulkUnitMenu(v => !v);
                                            setShowBulkTypeMenu(false);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition active:scale-95"
                                    >
                                        <span>Change Unit</span>
                                        <ChevronDown size={12} />
                                    </button>
                                    {showBulkUnitMenu && (
                                        <div className="absolute right-0 bottom-full mb-2 w-56 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-xl z-[6600] p-2 text-xs text-gray-800 dark:text-gray-200 font-medium">
                                            <input
                                                type="text"
                                                placeholder="Search unit..."
                                                className="w-full px-2 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs mb-1 font-medium focus:outline-none"
                                                value={bulkUnitSearch}
                                                onChange={e => setBulkUnitSearch(e.target.value)}
                                            />
                                            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                                                {UNIT_OPTIONS
                                                    .filter(u => u.name.toLowerCase().includes(bulkUnitSearch.toLowerCase()) || u.symbol.toLowerCase().includes(bulkUnitSearch.toLowerCase()))
                                                    .map(u => (
                                                        <button
                                                            key={u.code}
                                                            onClick={() => handleBulkChangeUnit(u.code)}
                                                            className="w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-xs flex justify-between font-semibold"
                                                        >
                                                            <span>{u.name}</span>
                                                            <span className="text-gray-400 font-mono">({u.symbol})</span>
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-bold transition active:scale-95 border border-red-500/30"
                                    title="Delete selected rows"
                                >
                                    <Trash2 size={13} />
                                    <span>Delete ({selectedIds.size})</span>
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition"
                            title="Clear selection"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Layout with optional Sidebar detail panel */}
            <div
                ref={tableContainerRef}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const lastRowIdx = sortedGridData.length > 0 ? sortedGridData.length - 1 : 0;
                    handleContextMenu(e, lastRowIdx, 0);
                }}
                className="flex-1 min-h-0 flex overflow-hidden w-full relative"
            >
                {/* Spreadsheet Grid Table */}
                <div className="flex-1 min-h-0 overflow-auto table-scrollbar">
                    <table className="w-full min-w-[1900px] table-fixed text-left whitespace-nowrap text-sm border-collapse bg-white dark:bg-[#0d1117] select-none">
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
                                <th className="px-3 py-3 w-12 min-w-12 max-w-12 text-center border-r border-gray-150 dark:border-white/5">#</th>
                                <th className="px-1 py-3 w-[82px] min-w-[82px] max-w-[82px] text-center border-r border-gray-150 dark:border-white/5">Status</th>

                                {/* Sortable Column Headers */}
                                {activeGridColumns.includes('code') && (
                                    <th
                                        onClick={() => handleSort('code')}
                                        className="px-3 py-3 w-32 min-w-32 max-w-32 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="truncate">Code</span>
                                            {sortConfig.key === 'code' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('name') && (
                                    <th
                                        onClick={() => handleSort('name')}
                                        className="px-3 py-3 w-60 min-w-56 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="truncate">Name <span className="text-red-500">*</span></span>
                                            {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('type') && (
                                    <th
                                        onClick={() => handleSort('type')}
                                        className="px-3 py-3 w-32 min-w-32 max-w-32 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="truncate">Type</span>
                                            {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('base_unit_code') && (
                                    <th
                                        onClick={() => handleSort('base_unit_code')}
                                        className="px-3 py-3 w-36 min-w-36 max-w-36 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="truncate">Base Unit <span className="text-red-500">*</span></span>
                                            {sortConfig.key === 'base_unit_code' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('rate') && (
                                    <th
                                        onClick={() => handleSort('rate')}
                                        className="px-3 py-3 w-44 min-w-44 max-w-44 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 truncate">
                                                <DollarSign size={12} /> Rate (₹)
                                            </span>
                                            {sortConfig.key === 'rate' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('compositions') && (
                                    <th className="px-3 py-3 w-64 min-w-64 max-w-64 border-r border-gray-150 dark:border-white/5">
                                        <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 truncate">
                                            <Layers size={12} />
                                            <span>Recipe / Components</span>
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('conversions') && (
                                    <th className="px-3 py-3 w-56 min-w-56 max-w-56 border-r border-gray-150 dark:border-white/5">
                                        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 truncate">
                                            <ArrowLeftRight size={12} />
                                            <span>Unit Conversions</span>
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('description') && (
                                    <th className="px-3 py-3 w-56 min-w-48 border-r border-gray-150 dark:border-white/5 truncate">Description</th>
                                )}
                                {activeGridColumns.includes('remarks') && (
                                    <th className="px-3 py-3 w-56 min-w-48 border-r border-gray-150 dark:border-white/5 truncate">Remarks</th>
                                )}
                                <th className="px-3 py-3 w-28 min-w-28 max-w-28 text-center">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {isLoading && resources.length === 0 ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`skel-row-${i}`} className="animate-pulse">
                                        {Array.from({ length: activeGridColumns.length + 4 }).map((_, j) => (
                                            <td key={`skel-cell-${i}-${j}`} className="px-3 py-3.5 border border-gray-100 dark:border-white/5">
                                                <div className="h-3 bg-gray-100 dark:bg-white/5 rounded"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : sortedGridData.length === 0 ? (
                                <tr onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); handleContextMenu(e, 0, 0); }}>
                                    <td colSpan={activeGridColumns.length + 4} className="py-24 text-center cursor-pointer">
                                        <div className="flex flex-col items-center gap-3">
                                            <Package className="text-gray-300 dark:text-white/10" size={44} />
                                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No resources found</p>
                                            <p className="text-xs text-gray-400">
                                                {searchTerm || filterType
                                                    ? 'Adjust your filters'
                                                    : 'Import an Excel spreadsheet, paste copied cells from Excel, or click below to start.'}
                                            </p>
                                            {canWrite && (
                                                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddRows(1)}
                                                        className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition cursor-pointer shadow-xs"
                                                    >
                                                        + Add First Resource
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
                                paginatedGridData.map((resource, index) => {
                                    const rowIndex = pageSize === 'All' ? index : (currentPage - 1) * Number(pageSize) + index;
                                    const originalResource = originalResourcesMap.get(resource.id);
                                    const isNew = resource._status === 'new' || String(resource.id).startsWith('temp_');
                                    const isError = resource._status === 'error';
                                    const isDirty = (resource._status === 'modified') || (originalResource && isResourceRowDirty(resource, originalResource));
                                    const rowErrors = resource._errors || {};
                                    const isRowSelected = selectedIds.has(resource.id);
                                    const isExpanded = expandedRowIds.has(resource.id);

                                    return (
                                        <React.Fragment key={resource.id || `row-${rowIndex}`}>
                                            <tr
                                                style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 42px' }}
                                                className={`hover:bg-blue-50/20 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 ${isRowSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                                                    } ${isExpanded ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''}`}
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

                                                {/* Row # & Chevron Toggle */}
                                                <td className="px-2 py-3 text-center font-mono text-[10px] text-gray-400 border-r border-gray-100 dark:border-white/5 select-none bg-gray-50/50 dark:bg-white/[0.01]">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleExpandRow(resource.id);
                                                            }}
                                                            className="p-0.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition"
                                                            title={isExpanded ? "Collapse Details" : "Expand Recipe & Conversions"}
                                                        >
                                                            {isExpanded ? <ChevronDown size={14} className="text-blue-500 stroke-[3]" /> : <ChevronRight size={14} />}
                                                        </button>
                                                        <span>{rowIndex + 1}</span>
                                                    </div>
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
                                                            title={rowErrors.server || Object.values(rowErrors).join(', ') || 'Validation error'}
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

                                                {/* â”€â”€â”€ GRID CELLS â”€â”€â”€ */}
                                                {activeGridColumns.map((colName, colIndex) => {
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
                                                    const isSpecialCol = colName === 'type' || colName === 'base_unit_code' || colName === 'rate' || colName === 'compositions' || colName === 'conversions';

                                                    return (
                                                        <td
                                                            key={colName}
                                                            id={`cell-${rowIndex}-${colName}`}
                                                            tabIndex={0}
                                                            onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
                                                            onMouseDown={(e) => {
                                                                if (e.target.closest('.z-\\[6000\\]')) return;
                                                                if (!isEdit) {
                                                                    e.preventDefault();
                                                                    window.getSelection()?.removeAllRanges();
                                                                }
                                                                if (e.shiftKey && selectionAnchor) {
                                                                    if (selectionFocus?.r !== rowIndex || selectionFocus?.c !== colIndex) {
                                                                        setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                    }
                                                                } else {
                                                                    if (selectionAnchor?.r !== rowIndex || selectionAnchor?.c !== colIndex || selectionFocus?.r !== rowIndex || selectionFocus?.c !== colIndex) {
                                                                        setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                        setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                    }
                                                                    setIsMouseDown(true);
                                                                }
                                                            }}
                                                            onMouseEnter={() => {
                                                                if (isMouseDown && (selectionFocus?.r !== rowIndex || selectionFocus?.c !== colIndex)) {
                                                                    setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                }
                                                            }}
                                                            onClick={(e) => {
                                                                if (e.target.closest('button') || e.target.closest('.z-\\[6000\\]')) return;
                                                                if (canWrite) {
                                                                    if (selectionAnchor?.r !== rowIndex || selectionAnchor?.c !== colIndex) {
                                                                        setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                        setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                    }
                                                                    if (colName === 'type' || colName === 'base_unit_code') {
                                                                        setActiveDropdownCell({ rowIndex, colName });
                                                                    } else if (colName === 'compositions' || colName === 'conversions') {
                                                                        // Keep normal expand
                                                                    } else {
                                                                        cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                                                                        setEditingCell({ rowIndex, colName });
                                                                    }
                                                                }
                                                            }}
                                                            onDoubleClick={() => {
                                                                if (canWrite) {
                                                                    if (selectionAnchor?.r !== rowIndex || selectionAnchor?.c !== colIndex) {
                                                                        setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                        setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                    }
                                                                    if (colName === 'type' || colName === 'base_unit_code') {
                                                                        setActiveDropdownCell({ rowIndex, colName });
                                                                    } else if (colName === 'compositions' || colName === 'conversions') {
                                                                        toggleExpandRow(resource.id);
                                                                    } else {
                                                                        cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                                                                        setEditingCell({ rowIndex, colName });
                                                                    }
                                                                }
                                                            }}
                                                            onKeyDown={e => handleCellKeyDown(e, rowIndex, colName)}
                                                            className={`p-0 border-r border-gray-100 dark:border-white/5 relative outline-none select-none overflow-hidden ${COLUMN_WIDTH_CLASSES[colName] || 'w-48 min-w-40'} ${isInRange ? 'bg-blue-500/15 dark:bg-blue-500/25 z-10' : ''
                                                                } ${isTopEdge ? 'border-t-2 border-t-blue-500' : ''} ${isBottomEdge ? 'border-b-2 border-b-blue-500' : ''
                                                                } ${isLeftEdge ? 'border-l-2 border-l-blue-500' : ''} ${isRightEdge ? 'border-r-2 border-r-blue-500' : ''
                                                                } ${hasError ? 'bg-red-500/5 ring-1 ring-red-500' : ''}`}
                                                        >
                                                            {isFillHandleCell && !isEdit && (
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

                                                            {/* Standard Text Cells Editing vs Normal State */}
                                                            {!isSpecialCol && (
                                                                isEdit ? (
                                                                    <div className="w-full flex items-center min-w-0 overflow-hidden">
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            className={`w-full min-w-0 max-w-full px-3 py-2 bg-white dark:bg-[#161b22] border border-blue-500 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none shadow-sm ${colName === 'code' ? 'font-mono' : colName === 'name' ? 'font-bold' : ''
                                                                                }`}
                                                                            value={resource[colName] || ''}
                                                                            onChange={e => handleCellChange(rowIndex, colName, e.target.value)}
                                                                            onBlur={handleCellBlur}
                                                                            onKeyDown={e => handleCellKeyDown(e, rowIndex, colName)}
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
                                                                            placeholder={
                                                                                colName === 'code' ? 'CEM-OPC' :
                                                                                    colName === 'name' ? 'Enter resource name...' :
                                                                                        colName === 'description' ? 'Short details...' : 'Internal specs...'
                                                                            }
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className={`w-full px-3 py-2 text-sm text-gray-800 dark:text-gray-200 truncate cursor-pointer min-h-[37px] flex items-center ${colName === 'code' ? 'font-mono' : colName === 'name' ? 'font-bold text-gray-900 dark:text-white' : ''
                                                                        }`}>
                                                                        {resource[colName] || <span className="text-gray-350 dark:text-white/10 font-normal italic">
                                                                            {colName === 'code' ? 'CEM-OPC' : colName === 'name' ? 'Enter resource name...' : colName === 'description' ? 'Short details...' : 'Internal specs...'}
                                                                        </span>}
                                                                    </div>
                                                                )
                                                            )}

                                                            {/* Rate Cell */}
                                                            {colName === 'rate' && (
                                                                isEdit ? (
                                                                    <div className="w-full flex items-center min-w-0 overflow-hidden">
                                                                        <input
                                                                            autoFocus
                                                                            type="number"
                                                                            step="0.01"
                                                                            className="w-full min-w-0 max-w-full px-3 py-2 bg-white dark:bg-[#161b22] border border-blue-500 text-sm font-mono font-bold text-gray-900 dark:text-white focus:outline-none shadow-sm"
                                                                            value={resource.rate ?? ''}
                                                                            onChange={e => {
                                                                                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                                                                handleCellChange(rowIndex, 'rate', val);
                                                                                handleCellChange(rowIndex, 'rate_source', 'manual');
                                                                            }}
                                                                            onBlur={handleCellBlur}
                                                                            onKeyDown={e => handleCellKeyDown(e, rowIndex, colName)}
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
                                                                            placeholder="0.00"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        onClick={() => {
                                                                            setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                            setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                        }}
                                                                        className="w-full px-3 py-2 text-sm cursor-pointer min-h-[37px] flex items-center justify-between gap-1 select-none"
                                                                    >
                                                                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                                                                            {resource.rate !== null && resource.rate !== undefined && !isNaN(Number(resource.rate))
                                                                                ? `₹ ${Number(resource.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                                : <span className="text-gray-400 font-normal italic">Set rate...</span>}
                                                                        </span>
                                                                        {resource.rate_source && (
                                                                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${resource.rate_source === 'manual'
                                                                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                                                                : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                                                                                }`}>
                                                                                {resource.rate_source === 'manual' ? 'MANUAL' : 'COMPUTED'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )
                                                            )}

                                                            {/* Compositions (Recipe) Cell */}
                                                            {colName === 'compositions' && (
                                                                <div className="w-full px-3 py-2 text-xs min-h-[37px] flex items-center justify-between gap-1 select-none">
                                                                    {resource.type !== 'item' ? (
                                                                        <span className="text-gray-350 dark:text-white/20 text-[11px] italic">N/A ({resource.type})</span>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1.5 overflow-hidden w-full justify-between">
                                                                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[180px]">
                                                                                {Array.isArray(resource.compositions) && resource.compositions.length > 0 ? (
                                                                                    resource.compositions.map((comp, idx) => (
                                                                                        <span key={comp.id || idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/20 rounded whitespace-nowrap">
                                                                                            <span>{comp.component_name || 'Item'}</span>
                                                                                            <span className="text-[9px] opacity-70">({comp.quantity} {comp.unit_code})</span>
                                                                                        </span>
                                                                                    ))
                                                                                ) : (
                                                                                    <span className="text-gray-400 italic text-[11px]">No recipe items</span>
                                                                                )}
                                                                            </div>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleExpandRow(resource.id);
                                                                                }}
                                                                                className="px-1.5 py-0.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px] font-extrabold rounded transition shrink-0"
                                                                                title="Edit recipe ingredients inline"
                                                                            >
                                                                                {Array.isArray(resource.compositions) && resource.compositions.length ? `${resource.compositions.length} item(s)` : '+ Recipe'}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Conversions (Unit Scale) Cell */}
                                                            {colName === 'conversions' && (
                                                                <div className="w-full px-3 py-2 text-xs min-h-[37px] flex items-center justify-between gap-1 select-none">
                                                                    {resource.type === 'labour' ? (
                                                                        <span className="text-gray-350 dark:text-white/20 text-[11px] italic">N/A (labour)</span>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1.5 overflow-hidden w-full justify-between">
                                                                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[150px]">
                                                                                {Array.isArray(resource.conversions) && resource.conversions.length > 0 ? (
                                                                                    resource.conversions.map((conv, idx) => (
                                                                                        <span key={conv.id || idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/20 rounded whitespace-nowrap">
                                                                                            <span>1 {conv.name}</span>
                                                                                            <span className="text-[9px] opacity-70">= {conv.quantity} {conv.unit_code}</span>
                                                                                        </span>
                                                                                    ))
                                                                                ) : (
                                                                                    <span className="text-gray-400 italic text-[11px]">No unit scales</span>
                                                                                )}
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleExpandRow(resource.id);
                                                                                }}
                                                                                className="px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold rounded transition shrink-0 cursor-pointer"
                                                                                title="Manage unit conversions inline"
                                                                            >
                                                                                {Array.isArray(resource.conversions) && resource.conversions.length ? `${resource.conversions.length} scale(s)` : '+ Scale'}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Type Dropdown Cell */}
                                                            {colName === 'type' && (
                                                                <>
                                                                    <div
                                                                        onClick={(e) => {
                                                                            if (selectionAnchor?.r !== rowIndex || selectionAnchor?.c !== colIndex) {
                                                                                setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                                setSelectionFocus({ r: rowIndex, c: colIndex });
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
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActiveDropdownCell(prev =>
                                                                                        prev?.rowIndex === rowIndex && prev?.colName === 'type' ? null : { rowIndex, colName: 'type' }
                                                                                    );
                                                                                }}
                                                                                className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-400 opacity-60 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                <ChevronDown size={12} />
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {activeDropdownCell?.rowIndex === rowIndex && activeDropdownCell?.colName === 'type' && (
                                                                        <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-2xl z-[6000] py-1 text-xs select-none no-scrollbar flex flex-col">
                                                                            {[
                                                                                { value: 'material', label: 'Material', icon: Package, color: 'text-amber-600 dark:text-amber-400' },
                                                                                { value: 'item', label: 'Item (Composite)', icon: Layers, color: 'text-purple-600 dark:text-purple-400' },
                                                                                { value: 'labour', label: 'Labour', icon: Users, color: 'text-blue-600 dark:text-blue-400' }
                                                                            ].map(opt => {
                                                                                const Icon = opt.icon;
                                                                                return (
                                                                                    <button
                                                                                        key={opt.value}
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleCellChange(rowIndex, 'type', opt.value, true);
                                                                                            closeDropdown();
                                                                                        }}
                                                                                        className="w-full text-left px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 flex items-center gap-2 font-semibold block whitespace-nowrap"
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
                                                                            if (selectionAnchor?.r !== rowIndex || selectionAnchor?.c !== colIndex) {
                                                                                setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                                setSelectionFocus({ r: rowIndex, c: colIndex });
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
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActiveDropdownCell(prev =>
                                                                                        prev?.rowIndex === rowIndex && prev?.colName === 'base_unit_code' ? null : { rowIndex, colName: 'base_unit_code' }
                                                                                    );
                                                                                }}
                                                                                className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-400 opacity-60 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                <ChevronDown size={12} />
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {activeDropdownCell?.rowIndex === rowIndex && activeDropdownCell?.colName === 'base_unit_code' && (
                                                                        <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-2xl z-[6000]">
                                                                            <div className="p-2 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="Search base units..."
                                                                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-md text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                                                                    value={unitSearch}
                                                                                    onChange={e => setUnitSearch(e.target.value)}
                                                                                    onClick={e => e.stopPropagation()}
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
                                                                            </div>

                                                                            <div className="max-h-56 overflow-y-auto py-1" style={{scrollbarWidth:'none',msOverflowStyle:'none'}}>
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

                                                                                    const rowUnitType = resource.base_unit_code ? UNIT_REGISTRY[resource.base_unit_code]?.type : null;

                                                                                    return filteredGroups.map(([type, units]) => {
                                                                                        const isGroupCompatible = !rowUnitType || resource._status === 'new' || type === rowUnitType;
                                                                                        return (
                                                                                            <div key={type} className={`px-1 py-1 ${!isGroupCompatible ? 'opacity-50' : ''}`}>
                                                                                                <div className="px-2 py-0.5 text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50/50 dark:bg-white/[0.01] rounded flex items-center justify-between">
                                                                                                    <span>{unitTypeLabel[type] || type}</span>
                                                                                                    {!isGroupCompatible && <span className="text-[8px] font-normal text-amber-500">Locked</span>}
                                                                                                </div>
                                                                                                {units.map(u => (
                                                                                                    <button
                                                                                                        key={u.code}
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            if (!isGroupCompatible) {
                                                                                                                showToast('error', 'Incompatible Unit Category', `Cannot change from ${rowUnitType.toUpperCase()} (${resource.base_unit_code}) to ${type.toUpperCase()} (${u.code}). Units must stay in the same category (e.g. g to kg, MT) to protect rates and recipes.`);
                                                                                                                return;
                                                                                                            }
                                                                                                            handleCellChange(rowIndex, 'base_unit_code', u.code, true);
                                                                                                            closeDropdown();
                                                                                                        }}
                                                                                                        className={`w-full text-left px-2.5 py-1.5 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold flex items-center justify-between ${
                                                                                                            isGroupCompatible ? 'hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer' : 'cursor-not-allowed'
                                                                                                        }`}
                                                                                                    >
                                                                                                        <span>{u.name}</span>
                                                                                                        <span className="text-[10px] text-gray-400 font-mono">({u.symbol})</span>
                                                                                                    </button>
                                                                                                ))}
                                                                                            </div>
                                                                                        );
                                                                                    });
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
                                                            <Info size={14} />
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

                                            {/* Expanded Inline Sub-Sheet Row */}
                                            {isExpanded && (
                                                <tr key={`expanded-${resource.id || rowIndex}`} className="bg-slate-50/80 dark:bg-[#10141d] border-b-2 border-blue-500/30">
                                                    <td colSpan={activeGridColumns.length + 4} className="p-4 pl-12 sticky left-0">
                                                        <div className={`bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-lg space-y-4 ${
                                                            resource.type === 'item' ? 'max-w-6xl w-full' : resource.type === 'material' ? 'max-w-3xl w-full' : 'max-w-xl w-full'
                                                        }`}>
                                                            {/* Header bar of expanded row */}
                                                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3 gap-3 flex-wrap">
                                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                                    <span className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
                                                                        {resource.name || 'Unnamed Resource'}
                                                                    </span>
                                                                    {resource.code && (
                                                                        <span className="font-mono text-xs text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded">
                                                                            {resource.code}
                                                                        </span>
                                                                    )}
                                                                    {(() => {
                                                                        const tc = TYPE_CONFIG[resource.type || 'material'] || TYPE_CONFIG.material;
                                                                        const TypeIcon = tc.icon;
                                                                        return (
                                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${tc.bg} ${tc.color}`}>
                                                                                <TypeIcon size={11} />
                                                                                {tc.label}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                    {resource.base_unit_code && (
                                                                        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                                                                            Base Unit: <strong className="text-gray-800 dark:text-gray-200">{UNIT_REGISTRY[resource.base_unit_code]?.name || resource.base_unit_code} ({UNIT_REGISTRY[resource.base_unit_code]?.symbol || resource.base_unit_code})</strong>
                                                                        </span>
                                                                    )}
                                                                    {resource.rate !== null && resource.rate !== undefined && (
                                                                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                                                                            Rate: ₹{Number(resource.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleExpandRow(resource.id)}
                                                                    className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg font-semibold flex items-center gap-1 transition cursor-pointer"
                                                                >
                                                                    <X size={13} /> Collapse Details
                                                                </button>
                                                            </div>

                                                            {/* Item: 2-Column Grid (Recipe Ingredients + Unit Conversions) */}
                                                            {resource.type === 'item' && (
                                                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                                                    {/* Section 1: Recipe Ingredients */}
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                                <Layers size={14} /> Composite Recipe Ingredients
                                                                            </span>
                                                                            <span className="text-[10px] font-semibold text-gray-400">
                                                                                {(Array.isArray(resource.compositions) ? resource.compositions : []).length} Component(s)
                                                                            </span>
                                                                        </div>

                                                                        <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
                                                                            <table className="w-full text-xs text-left">
                                                                                <thead className="bg-gray-100 dark:bg-white/5 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/5">
                                                                                    <tr>
                                                                                        <th className="p-2.5">Ingredient / Component</th>
                                                                                        <th className="p-2.5 w-24 text-right">Quantity</th>
                                                                                        <th className="p-2.5 w-20 text-center">Unit</th>
                                                                                        <th className="p-2.5 w-12 text-center">Action</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                                                    {!(Array.isArray(resource.compositions) && resource.compositions.length > 0) ? (
                                                                                        <tr>
                                                                                            <td colSpan="4" className="p-4 text-center text-gray-400 italic text-xs">
                                                                                                No recipe ingredients added yet.
                                                                                            </td>
                                                                                        </tr>
                                                                                    ) : (
                                                                                        (resource.compositions || []).map((comp, cIdx) => (
                                                                                            <tr key={comp.id || cIdx} className="hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors">
                                                                                                <td className="p-2.5 font-semibold text-gray-800 dark:text-gray-200">
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        <span>{comp.component_name || `Resource #${comp.component_resource_id}`}</span>
                                                                                                        {comp.component_code && (
                                                                                                            <span className="text-[9px] font-mono text-gray-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                                                                                                                {comp.component_code}
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </td>
                                                                                                <td className="p-2.5 font-mono font-bold text-right text-purple-600 dark:text-purple-400">
                                                                                                    {comp.quantity}
                                                                                                </td>
                                                                                                <td className="p-2.5 font-mono text-center text-gray-500 dark:text-gray-400">
                                                                                                    {comp.unit_code}
                                                                                                </td>
                                                                                                <td className="p-2.5 text-center">
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() => handleDeleteInlineComposition(resource.id, comp.id)}
                                                                                                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition hover:bg-red-50 dark:hover:bg-red-950/30"
                                                                                                        title="Remove ingredient"
                                                                                                    >
                                                                                                        <Trash2 size={13} />
                                                                                                    </button>
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))
                                                                                    )}
                                                                                </tbody>
                                                                            </table>

                                                                            {/* Quick Add Form */}
                                                                            {canWrite && (
                                                                                <div className="p-2.5 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/10 flex items-center gap-2 flex-wrap">
                                                                                    <select
                                                                                        className="flex-1 min-w-[180px] px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg text-xs font-medium text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                                                        value={newCompForm.component_resource_id}
                                                                                        onChange={e => {
                                                                                            const selectedId = e.target.value;
                                                                                            const selectedResource = resourcesRef.current.find(r => String(r.id) === String(selectedId));
                                                                                            setNewCompForm(prev => ({
                                                                                                ...prev,
                                                                                                component_resource_id: selectedId,
                                                                                                unit_code: selectedResource?.base_unit_code || prev.unit_code
                                                                                            }));
                                                                                        }}
                                                                                    >
                                                                                        <option value="">Select component resource...</option>
                                                                                        {(() => {
                                                                                            const existingCompIds = new Set(
                                                                                                (resource.compositions || []).map(c => String(c.component_resource_id))
                                                                                            );
                                                                                            return resourcesRef.current
                                                                                                .filter(r => String(r.id) !== String(resource.id) && !existingCompIds.has(String(r.id)));
                                                                                        })()
                                                                                            .map(r => (
                                                                                                <option key={r.id} value={r.id}>
                                                                                                    {r.name} ({r.base_unit_code})
                                                                                                </option>
                                                                                            ))
                                                                                        }
                                                                                    </select>
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.01"
                                                                                        placeholder="Qty"
                                                                                        className="w-20 px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg text-xs font-mono font-bold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                                                        value={newCompForm.quantity}
                                                                                        onChange={e => setNewCompForm(prev => ({ ...prev, quantity: e.target.value }))}
                                                                                    />
                                                                                    <select
                                                                                        className="w-24 px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg text-xs font-medium text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                                                        value={newCompForm.unit_code}
                                                                                        onChange={e => setNewCompForm(prev => ({ ...prev, unit_code: e.target.value }))}
                                                                                    >
                                                                                        {UNIT_OPTIONS.map(u => (
                                                                                            <option key={u.code} value={u.code}>{u.code}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            if (!newCompForm.component_resource_id) {
                                                                                                showToast('error', 'Select Resource', 'Please select a component resource.');
                                                                                                return;
                                                                                            }
                                                                                            handleAddInlineComposition(resource.id, newCompForm.component_resource_id, newCompForm.quantity, newCompForm.unit_code);
                                                                                            setNewCompForm({ component_resource_id: '', quantity: '1', unit_code: 'kg' });
                                                                                        }}
                                                                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
                                                                                    >
                                                                                        <Plus size={13} /> Add
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Section 2: Unit Conversion Scales */}
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                                <ArrowLeftRight size={14} /> Unit Conversion Scales
                                                                            </span>
                                                                            <span className="text-[10px] font-semibold text-gray-400">
                                                                                {(Array.isArray(resource.conversions) ? resource.conversions : []).length} Conversion(s)
                                                                            </span>
                                                                        </div>

                                                                        <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
                                                                            <table className="w-full text-xs text-left">
                                                                                <thead className="bg-gray-100 dark:bg-white/5 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/5">
                                                                                    <tr>
                                                                                        <th className="p-2.5">Conversion Scale</th>
                                                                                        <th className="p-2.5 w-28 text-right">Equivalent Qty</th>
                                                                                        <th className="p-2.5 w-20 text-center">Base Unit</th>
                                                                                        <th className="p-2.5 w-12 text-center">Action</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                                                    {!(Array.isArray(resource.conversions) && resource.conversions.length > 0) ? (
                                                                                        <tr>
                                                                                            <td colSpan="4" className="p-4 text-center text-gray-400 italic text-xs">
                                                                                                No unit conversion scales added.
                                                                                            </td>
                                                                                        </tr>
                                                                                    ) : (
                                                                                        (resource.conversions || []).map((conv, cvIdx) => (
                                                                                            <tr key={conv.id || cvIdx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                                                                                <td className="p-2.5 font-semibold text-gray-800 dark:text-gray-200">
                                                                                                    1 {conv.name}
                                                                                                </td>
                                                                                                <td className="p-2.5 font-mono font-bold text-right text-blue-600 dark:text-blue-400">
                                                                                                    {conv.quantity}
                                                                                                </td>
                                                                                                <td className="p-2.5 font-mono text-center text-gray-500 dark:text-gray-400">
                                                                                                    {conv.unit_code || resource.base_unit_code}
                                                                                                </td>
                                                                                                <td className="p-2.5 text-center">
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() => handleDeleteInlineConversion(resource.id, conv.id)}
                                                                                                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition hover:bg-red-50 dark:hover:bg-red-950/30"
                                                                                                        title="Remove conversion"
                                                                                                    >
                                                                                                        <Trash2 size={13} />
                                                                                                    </button>
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))
                                                                                    )}
                                                                                </tbody>
                                                                            </table>

                                                                            {/* Quick Add Form */}
                                                                            {canWrite && (
                                                                                <div className="p-2.5 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/10 flex items-center gap-2 flex-wrap">
                                                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 font-mono">1</span>
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="Scale Name (e.g. Box, Ton, Bag)"
                                                                                        className="flex-1 min-w-[160px] px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg text-xs font-medium text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                        value={newConvForm.name}
                                                                                        onChange={e => setNewConvForm(prev => ({ ...prev, name: e.target.value }))}
                                                                                    />
                                                                                    <span className="text-xs font-bold text-gray-400">=</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.01"
                                                                                        placeholder="Qty"
                                                                                        className="w-20 px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg text-xs font-mono font-bold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                        value={newConvForm.quantity}
                                                                                        onChange={e => setNewConvForm(prev => ({ ...prev, quantity: e.target.value }))}
                                                                                    />
                                                                                    <select
                                                                                        className="w-24 px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg text-xs font-medium text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                        value={newConvForm.unit_code}
                                                                                        onChange={e => setNewConvForm(prev => ({ ...prev, unit_code: e.target.value }))}
                                                                                    >
                                                                                        {(UNIT_GROUPS[UNIT_REGISTRY[resource.base_unit_code]?.type] || UNIT_OPTIONS).map(u => (
                                                                                            <option key={u.code} value={u.code}>{u.code}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            if (!newConvForm.name || !newConvForm.name.trim()) {
                                                                                                showToast('error', 'Enter Scale Name', 'Please enter a unit conversion scale name (e.g. Box, Ton, Bag).');
                                                                                                return;
                                                                                            }
                                                                                            handleAddInlineConversion(resource.id, newConvForm.name, newConvForm.quantity, newConvForm.unit_code);
                                                                                            setNewConvForm({ name: '', quantity: '1', unit_code: resource.base_unit_code || 'kg' });
                                                                                        }}
                                                                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
                                                                                    >
                                                                                        <Plus size={13} /> Add
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Material: Single Column (Unit Conversion Scales only) */}
                                                            {resource.type === 'material' && (
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                            <ArrowLeftRight size={14} /> Unit Conversion Scales
                                                                        </span>
                                                                        <span className="text-[10px] font-semibold text-gray-400">
                                                                            {(Array.isArray(resource.conversions) ? resource.conversions : []).length} Conversion(s)
                                                                        </span>
                                                                    </div>

                                                                    <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
                                                                        <table className="w-full text-xs text-left">
                                                                            <thead className="bg-gray-100 dark:bg-white/5 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/5">
                                                                                <tr>
                                                                                    <th className="p-2.5">Conversion Scale</th>
                                                                                    <th className="p-2.5 w-28 text-right">Equivalent Qty</th>
                                                                                    <th className="p-2.5 w-20 text-center">Base Unit</th>
                                                                                    <th className="p-2.5 w-12 text-center">Action</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                                                {!(Array.isArray(resource.conversions) && resource.conversions.length > 0) ? (
                                                                                    <tr>
                                                                                        <td colSpan="4" className="p-4 text-center text-gray-400 italic text-xs">
                                                                                            No unit conversion scales added.
                                                                                        </td>
                                                                                    </tr>
                                                                                ) : (
                                                                                    (resource.conversions || []).map((conv, cvIdx) => (
                                                                                        <tr key={conv.id || cvIdx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                                                                            <td className="p-2.5 font-semibold text-gray-800 dark:text-gray-200">
                                                                                                1 {conv.name}
                                                                                            </td>
                                                                                            <td className="p-2.5 font-mono font-bold text-right text-blue-600 dark:text-blue-400">
                                                                                                {conv.quantity}
                                                                                            </td>
                                                                                            <td className="p-2.5 font-mono text-center text-gray-500 dark:text-gray-400">
                                                                                                {conv.unit_code || resource.base_unit_code}
                                                                                            </td>
                                                                                            <td className="p-2.5 text-center">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => handleDeleteInlineConversion(resource.id, conv.id)}
                                                                                                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition hover:bg-red-50 dark:hover:bg-red-950/30"
                                                                                                    title="Remove conversion"
                                                                                                >
                                                                                                    <Trash2 size={13} />
                                                                                                </button>
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))
                                                                                )}
                                                                            </tbody>
                                                                        </table>

                                                                        {/* Quick Add Form */}
                                                                        {canWrite && (
                                                                            <div className="p-2.5 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/10 flex items-center gap-2 flex-wrap">
                                                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 font-mono">1</span>
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="Scale Name (e.g. Box, Ton, Bag)"
                                                                                    className="flex-1 min-w-[160px] px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg text-xs font-medium text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                    value={newConvForm.name}
                                                                                    onChange={e => setNewConvForm(prev => ({ ...prev, name: e.target.value }))}
                                                                                />
                                                                                <span className="text-xs font-bold text-gray-400">=</span>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    placeholder="Qty"
                                                                                    className="w-20 px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg text-xs font-mono font-bold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                    value={newConvForm.quantity}
                                                                                    onChange={e => setNewConvForm(prev => ({ ...prev, quantity: e.target.value }))}
                                                                                />
                                                                                <select
                                                                                    className="w-24 px-2.5 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg text-xs font-medium text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                                    value={newConvForm.unit_code}
                                                                                    onChange={e => setNewConvForm(prev => ({ ...prev, unit_code: e.target.value }))}
                                                                                >
                                                                                    {(UNIT_GROUPS[UNIT_REGISTRY[resource.base_unit_code]?.type] || UNIT_OPTIONS).map(u => (
                                                                                        <option key={u.code} value={u.code}>{u.code}</option>
                                                                                    ))}
                                                                                </select>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        if (!newConvForm.name || !newConvForm.name.trim()) {
                                                                                            showToast('error', 'Enter Scale Name', 'Please enter a unit conversion scale name (e.g. Box, Ton, Bag).');
                                                                                            return;
                                                                                        }
                                                                                        handleAddInlineConversion(resource.id, newConvForm.name, newConvForm.quantity, newConvForm.unit_code);
                                                                                        setNewConvForm({ name: '', quantity: '1', unit_code: resource.base_unit_code || 'kg' });
                                                                                    }}
                                                                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
                                                                                >
                                                                                    <Plus size={13} /> Add
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Labour: Clean Info Card */}
                                                            {resource.type === 'labour' && (
                                                                <div className="p-4 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-500/20 rounded-lg flex items-start gap-3">
                                                                    <Users className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
                                                                    <div className="space-y-1 text-xs">
                                                                        <p className="font-bold text-gray-900 dark:text-white">Labour Resource</p>
                                                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                                                            Labour represents manpower/workforce. Manpower entries do not use recipe composition ingredients or packaging conversions. Rates are applied directly per base unit (<span className="font-semibold text-blue-600 dark:text-blue-400">{resource.base_unit_code}</span>).
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}

                            {canWrite && sortedGridData.length > 0 && (
                                <tr
                                    onClick={() => handleAddRows(1)}
                                    className="hover:bg-blue-50/40 dark:hover:bg-blue-900/10 cursor-pointer border-t border-dashed border-gray-200 dark:border-white/10 transition-colors group/add-row select-none"
                                >
                                    <td colSpan={activeGridColumns.length + 4} className="py-2.5 px-4 text-xs font-semibold text-gray-400 group-hover/add-row:text-blue-600 dark:group-hover/add-row:text-blue-400">
                                        <div className="flex items-center gap-2">
                                            <Plus size={14} className="stroke-[2.5]" />
                                            <span>+ Add Row at End of Table</span>
                                        </div>
                                    </td>
                                </tr>
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
                                    resources={resources}
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

            {/* Slide-over Resource Detail Drawer */}
            <AnimatePresence>
                {viewingResource && (
                    <ResourceDetail
                        resourceId={viewingResource}
                        resources={resources}
                        onClose={() => setViewingResource(null)}
                        onUpdate={() => fetchData(true)}
                        onNavigateTab={(tab, id) => setActiveTab(tab, id)}
                        canWrite={canWrite}
                        showToast={showToast}
                        setConfirmModal={setConfirmModal}
                    />
                )}
            </AnimatePresence>

            {/* Quick + Add Resource Modal */}
            {isAddFormOpen && (
                <ResourceForm
                    onClose={() => setIsAddFormOpen(false)}
                    onSave={() => {
                        setIsAddFormOpen(false);
                        fetchData(true);
                        showToast('success', 'Resource Created', 'New resource saved successfully.');
                    }}
                />
            )}

            <DuplicateResolverModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                title="Remove Duplicate Resources"
                gridData={gridData}
                getKey={(row) => {
                    const cleanName = (row.name || '').replace(/\s*\(\s*copy(?:\s+\d+)?\s*\)/gi, '').trim().toLowerCase();
                    const cleanCode = (row.code || '').replace(/[-_]copy(?:[-_]\d+)?$/gi, '').trim().toLowerCase();
                    return cleanName || cleanCode;
                }}
                getLabel={(row) => row.name || 'Unnamed Resource'}
                getSubLabel={(row) => [row.code, row.type, row.base_unit_code].filter(Boolean).join(' â€¢ ')}
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
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Import resource files or paste cells directly with real-time preview</p>
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
                                        title="Download blank resource spreadsheet template"
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
                                                                const parsed = parseRawRowsToResources(parseExcelClipboardText(text));
                                                                setExcelParsedResources(parsed);
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
                                                    const parsed = parseRawRowsToResources(parseExcelClipboardText(text));
                                                    setExcelParsedResources(parsed);
                                                    setExcelSourceFileName(text.trim() ? 'Pasted text' : '');
                                                }}
                                                placeholder="Paste your copied rows here (Ctrl+V)... Header columns like 'Resource Code', 'Resource Name', 'Type', 'Base Unit', 'Rate (₹)', 'Description', 'Remarks' will be automatically mapped."
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
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${excelParsedResources.length > 0
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400 border-gray-200 dark:border-white/10'
                                                    }`}>
                                                    {excelParsedResources.length} {excelParsedResources.length === 1 ? 'Row' : 'Rows'}
                                                </span>
                                            </div>

                                            {excelParsedResources.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setExcelParsedResources([]);
                                                        setExcelPasteText('');
                                                        setExcelSourceFileName('');
                                                    }}
                                                    className="text-[11px] text-red-500 hover:text-red-600 font-bold hover:underline cursor-pointer"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>

                                        {excelParsedResources.length === 0 ? (
                                            <div className="p-8 border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-center bg-gray-50/50 dark:bg-white/[0.01]">
                                                <FileText size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">No data parsed yet</p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">Upload a spreadsheet or paste rows to see a live preview of all mapped columns.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 table-scrollbar">
                                                {excelParsedResources.map((item, idx) => {
                                                    const tc = TYPE_CONFIG[item.type || 'material'] || TYPE_CONFIG.material;
                                                    const TypeIcon = tc.icon;
                                                    return (
                                                        <div
                                                            key={item.id || idx}
                                                            className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] shadow-xs space-y-2 text-xs"
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="text-[10px] font-mono font-bold text-gray-400 shrink-0">#{idx + 1}</span>
                                                                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-500/20">
                                                                        {item.code || 'NO-CODE'}
                                                                    </span>
                                                                    <span className="font-bold text-gray-900 dark:text-white truncate">
                                                                        {item.name || <span className="text-red-500 italic">No Name</span>}
                                                                    </span>
                                                                </div>
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border shrink-0 ${tc.bg} ${tc.color}`}>
                                                                    <TypeIcon size={10} />
                                                                    {tc.label}
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-2">
                                                                <div>
                                                                    <span className="text-gray-400">Base Unit: </span>
                                                                    <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">
                                                                        {UNIT_REGISTRY[item.base_unit_code]?.symbol || item.base_unit_code || 'kg'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-400">Rate: </span>
                                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                                        {item.rate !== null && item.rate !== undefined ? `₹ ${Number(item.rate).toFixed(2)}` : '—'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-400">Type: </span>
                                                                    <span className="capitalize text-gray-700 dark:text-gray-300 font-medium">{item.type || 'material'}</span>
                                                                </div>
                                                            </div>

                                                            {(item.description || item.remarks) && (
                                                                <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.02] p-2 rounded-lg border border-gray-100 dark:border-white/5 space-y-0.5">
                                                                    {item.description && (
                                                                        <p className="truncate">
                                                                            <span className="text-gray-400">Desc: </span>
                                                                            {item.description}
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
                                                    );
                                                })}
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
                                            disabled={excelParsedResources.length === 0}
                                            className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${excelParsedResources.length > 0
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-95 cursor-pointer'
                                                : 'bg-gray-200 dark:bg-white/10 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            <CheckCircle size={14} />
                                            <span>Add to Resources ({excelParsedResources.length})</span>
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
            </div>
        </div>
    );
};

export default ResourceList;
