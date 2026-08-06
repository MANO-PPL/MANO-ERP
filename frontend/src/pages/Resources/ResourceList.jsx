import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Search, Plus, Trash2, Info, RefreshCw, Package, Layers, Users, X, Upload,
    Download, Save, RotateCcw, AlertCircle, ChevronDown, ChevronRight, Copy, Eye, CheckSquare,
    Square, ArrowUpDown, ArrowUp, ArrowDown, Filter, Sparkles, Check, DollarSign, ArrowLeftRight, Scale, Edit3
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
import LogoLoader from '../../components/LogoLoader';

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
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);

    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'grid';
    const targetResourceId = searchParams.get('resourceId') || '';

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

    // Helper to get initial cached state for 0ms render time
    const getInitialResources = () => {
        try {
            const cached = sessionStorage.getItem('mano_resources_cache');
            if (cached) return JSON.parse(cached);
        } catch (e) { }
        return [];
    };

    const getInitialGridData = (resourcesList) => {
        return resourcesList.map(r => ({
            ...r,
            _status: 'saved',
            _errors: {}
        }));
    };

    const initialResources = getInitialResources();

    // Original list from server
    const [resources, setResources] = useState(initialResources);
    const resourcesRef = useRef(resources);
    resourcesRef.current = resources;

    // Spreadsheet grid state
    const [gridData, setGridData] = useState(() => getInitialGridData(initialResources));
    const gridDataRef = useRef(gridData);
    gridDataRef.current = gridData;

    // Deleted IDs tracking for manual save
    const [deletedIds, setDeletedIds] = useState(new Set());

    const hasUnsavedChanges = useMemo(() => {
        const hasModified = gridData.some(r => (r._status === 'modified' || r._status === 'new') && r.name && r.name.trim() && r.base_unit_code);
        return hasModified || deletedIds.size > 0;
    }, [gridData, deletedIds]);

    const unsavedCount = useMemo(() => {
        const count = gridData.filter(r => (r._status === 'modified' || r._status === 'new') && r.name && r.name.trim() && r.base_unit_code).length;
        return count + deletedIds.size;
    }, [gridData, deletedIds]);

    const hasPendingCompositionChanges = useMemo(() => gridData.some(row => (
        row._compositionModified && row.type === 'item'
    )), [gridData]);

    const hasPendingRateChanges = useMemo(() => gridData.some(row => row._rateModified), [gridData]);

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

    const [isLoading, setIsLoading] = useState(() => initialResources.length === 0);
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

    // Click outside handler for Column Selector Dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (columnSelectorRef.current && !columnSelectorRef.current.contains(e.target)) {
                setIsColumnSelectorOpen(false);
            }
        };
        if (isColumnSelectorOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isColumnSelectorOpen]);

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

    // Stats
    const stats = {
        total: resources.length,
        materials: resources.filter(r => r.type === 'material').length,
        items: resources.filter(r => r.type === 'item').length,
        labour: resources.filter(r => r.type === 'labour').length,
    };

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

        if (_compositionModified && row.type === 'item') {
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

        if (_rateModified) {
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
        const newRows = targetGrid.filter(r => r._status === 'new' && r.name && r.name.trim() && r.base_unit_code);
        const modifiedRows = targetGrid.filter(r => r._status === 'modified' && r.name && r.name.trim() && r.base_unit_code);
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

            let createdResults = [];
            if (newPayloadRows.length > 0) {
                const cleanPayload = newPayloadRows.map(row => {
                    const payload = prepareResourcePayload(row);
                    delete payload.id;
                    return payload;
                });
                const res = await resourceApi.bulkCreateResources(cleanPayload);
                createdResults = res?.resources || res?.data || (Array.isArray(res) ? res : []);
            }

            if (validModifiedRows.length > 0) {
                const cleanPayload = validModifiedRows.map(prepareResourcePayload);
                await resourceApi.bulkUpdateResources(cleanPayload);
            }

            setGridData(prevGrid => {
                const createdMap = new Map();
                if (createdResults.length > 0) {
                    newPayloadRows.forEach((nr, i) => {
                        if (createdResults[i]) createdMap.set(nr.id, createdResults[i]);
                    });
                }

                return prevGrid.map(row => {
                    if (validModifiedRows.some(m => m.id === row.id)) {
                        return { ...row, _status: 'saved', _errors: {}, _compositionModified: false, _rateModified: false };
                    }
                    if (createdMap.has(row.id)) {
                        const realRes = createdMap.get(row.id);
                        return {
                            ...row,
                            id: realRes.id,
                            code: realRes.code || row.code,
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
                validModifiedRows.forEach(mod => {
                    const idx = updated.findIndex(r => r.id === mod.id);
                    if (idx !== -1) updated[idx] = {
                        ...updated[idx],
                        ...mod,
                        _status: 'saved',
                        _compositionModified: false,
                        _rateModified: false
                    };
                });
                if (createdResults.length > 0) {
                    createdResults.forEach(c => {
                        if (!updated.some(r => r.id === c.id)) updated.push(c);
                    });
                }
                return updated;
            });

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

    // Sorting & Filtering local grid data (Memoized)
    const filteredGridData = useMemo(() => {
        if (!searchTerm && !filterType && activeFilters.types.length === 0 && activeFilters.units.length === 0 && activeFilters.statuses.length === 0) {
            return gridData;
        }
        const lowerSearch = searchTerm.toLowerCase();
        return gridData.filter(r => {
            const matchesType = filterType ? r.type === filterType : true;
            const matchesSearch = !searchTerm ||
                (r.name || '').toLowerCase().includes(lowerSearch) ||
                (r.code && r.code.toLowerCase().includes(lowerSearch)) ||
                (r.description && r.description.toLowerCase().includes(lowerSearch));

            const matchesTypeFilter = activeFilters.types.length === 0 || activeFilters.types.includes(r.type);
            const matchesUnitFilter = activeFilters.units.length === 0 || activeFilters.units.includes(r.base_unit_code);
            const matchesStatusFilter = activeFilters.statuses.length === 0 || activeFilters.statuses.includes(r._status || 'saved');

            return matchesType && matchesSearch && matchesTypeFilter && matchesUnitFilter && matchesStatusFilter;
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

    // ─── Custom Context Menu & Excel Fill Operations ───────────────────────
    const [contextMenu, setContextMenu] = useState(null); // { x: number, y: number, rowIndex: number, colIndex: number }

    // Auto-scroll focused cell into view during keyboard navigation
    useEffect(() => {
        if (selectionFocus && tableContainerRef.current) {
            const colName = GRID_COLUMNS[selectionFocus.c];
            const cellEl = document.getElementById(`cell-${selectionFocus.r}-${colName}`);
            if (cellEl) {
                cellEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        }
    }, [selectionFocus]);

    const handleContextMenu = (e, rowIndex, colIndex) => {
        e.preventDefault();
        e.stopPropagation();

        const curBounds = getSelectionBounds();
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
                const col = GRID_COLUMNS[c];
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

            const sourceColName = GRID_COLUMNS[bounds.minCol];
            const fillVal = targetRowObj[sourceColName];

            const rowCopy = { ...updatedGrid[realIdx] };
            for (let c = bounds.minCol + 1; c <= bounds.maxCol; c++) {
                const col = GRID_COLUMNS[c];
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
                const col = GRID_COLUMNS[c];
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

        setSelectionAnchor({ r: insertIdx, c: 1 });
        setSelectionFocus({ r: insertIdx, c: 1 });
        showToast('info', 'Row Inserted', `Inserted new row ${position} row #${targetRowIndex + 1}.`);
    };

    // ─── Global Keyboard Shortcuts ──────────────────────────────────────────
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
                        const totalCols = activeGridColumns.length;
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



            // Alt+N : Add New Row at end of table (Excel behavior)
            if (e.altKey && (e.key === 'n' || e.key === 'N')) {
                if (canWrite) {
                    e.preventDefault();
                    handleAddRows(1);
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
                        c: activeGridColumns.length - 1
                    });
                    const allIds = new Set(sortedGridDataRef.current.map(r => r.id));
                    setSelectedIds(allIds);
                    showToast('info', 'Selected All', `Selected all ${sortedGridDataRef.current.length} row(s) and cells.`);
                }
                return;
            }

            // Ctrl+D : Fill Down
            if (modifier && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                handleFillDown();
                return;
            }

            // Ctrl+R : Fill Right
            if (modifier && (e.key === 'r' || e.key === 'R')) {
                e.preventDefault();
                handleFillRight();
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

    // ─── Cell Copy (Ctrl+C), Cut (Ctrl+X), & Paste (Ctrl+V) Core Functions ─────
    const executeCopy = (clipboardEvent = null) => {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') return null;

        let rowsToCopy = [];
        let minCol = 0;
        let maxCol = activeGridColumns.length - 1;

        const bounds = getSelectionBounds();

        if (bounds) {
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
        } else if (selectedIds.size > 0) {
            rowsToCopy = sortedGridDataRef.current.filter(r => selectedIds.has(r.id));
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
        if (tsvData) {
            if (clipboardEvent && clipboardEvent.clipboardData) {
                clipboardEvent.clipboardData.setData('text/plain', tsvData);
                clipboardEvent.preventDefault();
            } else {
                navigator.clipboard?.writeText(tsvData).catch(err => console.warn('Clipboard write error:', err));
            }
            const numCells = tsvLines.length * (maxCol - minCol + 1);
            showToast('sparkle', 'Copied to Clipboard', `Copied ${numCells} cell(s) across ${tsvLines.length} row(s)`);
        }
        return tsvData;
    };

    const executeCut = (clipboardEvent = null) => {
        const bounds = getSelectionBounds();
        if (!bounds || !canWrite) return;

        executeCopy(clipboardEvent);

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
            showToast('sparkle', 'Cut to Clipboard', `Cut values from ${numCleared} cell(s).`);
        }
    };

    const executePaste = async (pastedDataText) => {
        let textToPaste = pastedDataText;
        if (!textToPaste) {
            try {
                textToPaste = await navigator.clipboard.readText();
            } catch (err) {
                console.warn('Clipboard read error:', err);
            }
        }

        if (!textToPaste || !textToPaste.trim()) {
            showToast('info', 'Clipboard Empty', 'No data found in clipboard.');
            return;
        }

        pushUndoState(gridDataRef.current);

        const lines = textToPaste.trim().split(/\r?\n/);
        let updatedGrid = [...gridDataRef.current];
        const newStartIdx = updatedGrid.length;
        let newRowsAddedCount = 0;

        lines.forEach((line, dr) => {
            if (!line.trim()) return;
            const cells = line.split('\t');

            let code = '';
            let name = '';
            let type = 'material';
            let base_unit_code = 'kg';
            let rate = null;
            let description = '';
            let remarks = '';

            if (cells.length >= 2) {
                const c0 = cells[0]?.trim() || '';
                const c1 = cells[1]?.trim() || '';

                if (c0 && c1) {
                    code = c0;
                    name = c1;
                } else if (c0 && !c1) {
                    name = c0;
                } else if (!c0 && c1) {
                    name = c1;
                }

                cells.forEach((val, colIdx) => {
                    const colName = activeGridColumns[colIdx];
                    const trimmed = val.trim();
                    if (!colName || !trimmed) return;

                    if (colName === 'type') {
                        type = resolveType(trimmed);
                    } else if (colName === 'base_unit_code') {
                        base_unit_code = resolveUnitCode(trimmed);
                    } else if (colName === 'rate') {
                        const parsedRate = parseFloat(trimmed.replace(/[^0-9.]/g, ''));
                        if (!isNaN(parsedRate)) rate = parsedRate;
                    } else if (colName === 'description') {
                        description = trimmed;
                    } else if (colName === 'remarks') {
                        remarks = trimmed;
                    }
                });
            } else {
                const singleVal = cells[0]?.trim() || '';
                if (singleVal) name = singleVal;
            }

            if (name || code) {
                if (!name && code) name = code;

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

                updatedGrid.push({
                    id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${dr}`,
                    code,
                    name,
                    type,
                    base_unit_code,
                    rate: rate !== null ? rate : null,
                    rate_source: rate !== null ? 'manual' : undefined,
                    description,
                    remarks,
                    compositions: [],
                    conversions: [],
                    _rateModified: rate !== null,
                    _status: 'new',
                    _errors: {}
                });
                newRowsAddedCount++;
            }
        });

        if (newRowsAddedCount > 0) {
            setGridData(updatedGrid);

            if (pageSize !== 'All') {
                const lastPage = Math.ceil(updatedGrid.length / Number(pageSize)) || 1;
                setCurrentPage(lastPage);
            }

            setTimeout(() => {
                setSelectionAnchor({ r: newStartIdx, c: 0 });
                setSelectionFocus({ r: updatedGrid.length - 1, c: activeGridColumns.length - 1 });
            }, 50);

            showToast('sparkle', 'Pasted New Rows at End', `Appended ${newRowsAddedCount} new resource row(s) to the bottom of the table.`);
        }
    };

    useEffect(() => {
        const handleGlobalCopy = (e) => {
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;
            executeCopy(e);
        };

        const handleGlobalCut = (e) => {
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;
            if (!canWrite) return;
            executeCut(e);
        };

        const handleGlobalPaste = (e) => {
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;
            if (!canWrite) return;

            const text = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text');
            e.preventDefault();
            executePaste(text);
        };

        window.addEventListener('copy', handleGlobalCopy);
        window.addEventListener('cut', handleGlobalCut);
        window.addEventListener('paste', handleGlobalPaste);
        return () => {
            window.removeEventListener('copy', handleGlobalCopy);
            window.removeEventListener('cut', handleGlobalCut);
            window.removeEventListener('paste', handleGlobalPaste);
        };
    }, [selectionAnchor, selectionFocus, canWrite]);

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
                    setSelectionFocus({ r: maxR, c: activeGridColumns.length - 1 });
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

            if (field === 'rate') {
                row._rateModified = true;
            }

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
    };

    const handleCellBlur = () => {
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

    // ─── Spreadsheet Keyboard Navigation & Range Operations ────────────────────
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
                    setEditingCell({ rowIndex: curFocus.r, colName });
                }
            }
            return;
        }

        // Direct typing replaces cell content
        if (canWrite && e.key.length === 1 && !isModifier && !e.altKey) {
            if (colName !== 'type' && colName !== 'base_unit_code') {
                setEditingCell({ rowIndex: curFocus.r, colName });
                handleCellChange(curFocus.r, colName, e.key);
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
            compositions: [],
            conversions: [],
            _status: 'new',
            _errors: {}
        }));
        
        let newStartIdx = 0;
        setGridData(prev => {
            newStartIdx = prev.length;
            const updated = [...prev, ...newRows];
            return updated;
        });

        const newTotalCount = gridDataRef.current.length + count;
        if (pageSize !== 'All') {
            const lastPage = Math.ceil(newTotalCount / Number(pageSize)) || 1;
            setCurrentPage(lastPage);
        }

        setTimeout(() => {
            setSelectionAnchor({ r: newStartIdx, c: 1 });
            setSelectionFocus({ r: newStartIdx + count - 1, c: activeGridColumns.length - 1 });
            setEditingCell({ rowIndex: newStartIdx, colName: 'name' });
        }, 50);

        showToast('info', 'Row Appended', `Appended ${count} new resource row(s) at the bottom of the table.`);
    };

    // ─── Duplicate Row ──────────────────────────────────────────────────────────
    const handleDuplicateRow = (targetRow) => {
        let row = targetRow;
        if (!row) {
            const bounds = getSelectionBounds();
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
        let newIdx = 0;
        setGridData(prev => {
            updatedGrid = [...prev, duplicate];
            newIdx = updatedGrid.length - 1;
            return updatedGrid;
        });

        if (pageSize !== 'All') {
            const lastPage = Math.ceil((gridDataRef.current.length + 1) / Number(pageSize)) || 1;
            setCurrentPage(lastPage);
        }

        setTimeout(() => {
            setSelectionAnchor({ r: newIdx, c: 0 });
            setSelectionFocus({ r: newIdx, c: activeGridColumns.length - 1 });
        }, 50);

        showToast('sparkle', 'Row Duplicated', `Duplicated "${row.name || 'resource'}" to the bottom of the table.`);
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

    // ─── Bulk Actions ───────────────────────────────────────────────────────────
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

                // Instant Optimistic UI Update (1-2ms)
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
        setGridData(prev => [...prev, ...duplicates]);
        const count = selectedIds.size;
        const totalCount = gridDataRef.current.length + duplicates.length;
        if (pageSize !== 'All') {
            const lastPage = Math.ceil(totalCount / Number(pageSize)) || 1;
            setCurrentPage(lastPage);
        }
        setSelectedIds(new Set());
        showToast('sparkle', 'Bulk Duplicated', `Appended ${count} row duplicate(s) at the bottom of the table.`);
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

    // ─── Export CSV ────────────────────────────────────────────────────────────
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

    const bounds = getSelectionBounds();

    if (activeTab !== 'grid') {
        const tabContent = activeTab === 'recipes' ? (
            <ResourceRecipesTab
                initialResourceId={targetResourceId}
                resources={resources}
                onRefreshResources={() => fetchData(true)}
                showToast={showToast}
            />
        ) : activeTab === 'rates' ? (
            <ResourceRatesTab
                initialResourceId={targetResourceId}
                resources={resources}
                onRefreshResources={() => fetchData(true)}
                showToast={showToast}
            />
        ) : (
            <ResourceConversionsTab
                initialResourceId={targetResourceId}
                resources={resources}
                onRefreshResources={() => fetchData(true)}
                showToast={showToast}
            />
        );

        return (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] h-full">
                <ResourceSubNav
                    activeTab={activeTab}
                    onChange={tab => setActiveTab(tab, targetResourceId || null)}
                />
                <div className="flex-1 min-h-0 overflow-hidden">
                    {tabContent}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full relative">

            <ResourceSubNav
                activeTab={activeTab}
                onChange={tab => setActiveTab(tab, targetResourceId || null)}
            />


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
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertCircle size={12} />
                                <span>Unsaved local changes</span>
                            </span>
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
                                        <span className="text-gray-300 dark:text-white/10">•</span>
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
                        className="flex items-center gap-1.5 px-3 py-1.5 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg text-xs font-semibold transition shrink-0"
                        title="Instantly find and remove duplicate rows"
                    >
                        <Copy size={13} />
                        <span>Remove Duplicates</span>
                    </button>

                    {/* Export CSV button */}
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-800 border border-gray-250 dark:text-gray-400 dark:hover:text-white dark:border-white/10 bg-transparent rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition shrink-0"
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

                    {/* Add Resource Button (Extreme Right) */}
                    {canWrite && (
                        <button
                            type="button"
                            onClick={() => handleAddRows(1)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer shrink-0"
                            title="Add new editable resource row directly to Excel grid"
                        >
                            <Plus size={14} className="stroke-[3]" />
                            <span>Add Resource</span>
                        </button>
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
                    <table className="w-full min-w-[1900px] text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117] select-none">
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
                                <th className="px-3 py-3 w-12 text-center border-r border-gray-150 dark:border-white/5">#</th>
                                <th className="px-2 py-3 w-16 text-center border-r border-gray-150 dark:border-white/5">Status</th>

                                {/* Sortable Column Headers */}
                                {activeGridColumns.includes('code') && (
                                    <th
                                        onClick={() => handleSort('code')}
                                        className="px-3 py-3 w-32 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>Code</span>
                                            {sortConfig.key === 'code' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('name') && (
                                    <th
                                        onClick={() => handleSort('name')}
                                        className="px-3 py-3 w-56 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>Name <span className="text-red-500">*</span></span>
                                            {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('type') && (
                                    <th
                                        onClick={() => handleSort('type')}
                                        className="px-3 py-3 w-32 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>Type</span>
                                            {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('base_unit_code') && (
                                    <th
                                        onClick={() => handleSort('base_unit_code')}
                                        className="px-3 py-3 w-36 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>Base Unit <span className="text-red-500">*</span></span>
                                            {sortConfig.key === 'base_unit_code' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('rate') && (
                                    <th
                                        onClick={() => handleSort('rate')}
                                        className="px-3 py-3 w-44 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                <DollarSign size={12} /> Rate (₹)
                                            </span>
                                            {sortConfig.key === 'rate' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('compositions') && (
                                    <th className="px-3 py-3 w-64 border-r border-gray-150 dark:border-white/5">
                                        <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                                            <Layers size={12} />
                                            <span>Recipe / Components</span>
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('conversions') && (
                                    <th className="px-3 py-3 w-56 border-r border-gray-150 dark:border-white/5">
                                        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                            <ArrowLeftRight size={12} />
                                            <span>Unit Conversions</span>
                                        </div>
                                    </th>
                                )}
                                {activeGridColumns.includes('description') && (
                                    <th className="px-3 py-3 w-48 border-r border-gray-150 dark:border-white/5">Description</th>
                                )}
                                {activeGridColumns.includes('remarks') && (
                                    <th className="px-3 py-3 w-48 border-r border-gray-150 dark:border-white/5">Remarks</th>
                                )}
                                <th className="px-3 py-3 w-28 text-center">Actions</th>
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
                                                {searchTerm || filterType ? 'Adjust your filters' : 'Copy rows from Excel and press Ctrl+V to paste instantly'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedGridData.map((resource, index) => {
                                    const rowIndex = pageSize === 'All' ? index : (currentPage - 1) * Number(pageSize) + index;
                                    const isNew = resource._status === 'new';
                                    const isError = resource._status === 'error';
                                    const rowErrors = resource._errors || {};
                                    const isRowSelected = selectedIds.has(resource.id);
                                    const isExpanded = expandedRowIds.has(resource.id);

                                    return (
                                        <React.Fragment key={resource.id || `row-${rowIndex}`}>
                                            <tr
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

                                                {/* ─── GRID CELLS ─── */}
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
                                                                        setEditingCell({ rowIndex, colName });
                                                                    }
                                                                }
                                                            }}
                                                            onKeyDown={e => handleCellKeyDown(e, rowIndex, colName)}
                                                            className={`p-0 border-r border-gray-100 dark:border-white/5 relative outline-none select-none ${isInRange ? 'bg-blue-500/15 dark:bg-blue-500/25 z-10' : ''
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

                                                            {/* Rate Cell */}
                                                            {colName === 'rate' && (
                                                                isEdit ? (
                                                                    <input
                                                                        autoFocus
                                                                        type="number"
                                                                        step="0.01"
                                                                        className="w-full px-3 py-2.5 bg-white dark:bg-[#161b22] border border-blue-500 text-xs font-mono font-bold text-gray-900 dark:text-white focus:outline-none shadow-sm"
                                                                        value={resource.rate ?? ''}
                                                                        onChange={e => {
                                                                            const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                                                            handleCellChange(rowIndex, 'rate', val);
                                                                            handleCellChange(rowIndex, 'rate_source', 'manual');
                                                                        }}
                                                                        onBlur={handleCellBlur}
                                                                        onKeyDown={e => handleCellKeyDown(e, rowIndex, colName)}
                                                                        placeholder="0.00"
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        onClick={() => {
                                                                            setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                            setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                        }}
                                                                        className="w-full px-3 py-2.5 text-xs cursor-pointer min-h-[37px] flex items-center justify-between gap-1 select-none"
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
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleExpandRow(resource.id);
                                                                            }}
                                                                            className="px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold rounded transition shrink-0"
                                                                            title="Manage unit conversions inline"
                                                                        >
                                                                            {Array.isArray(resource.conversions) && resource.conversions.length ? `${resource.conversions.length} scale(s)` : '+ Scale'}
                                                                        </button>
                                                                    </div>
                                                                </div>
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
                                                <tr key={`expanded-${resource.id || rowIndex}`} className="bg-slate-50 dark:bg-[#121721] border-b-2 border-blue-500/30">
                                                    <td colSpan={activeGridColumns.length + 4} className="p-4 pl-12 sticky left-0">
                                                        <div className={`bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-lg space-y-4 ${resource.type !== 'item' ? 'max-w-2xl' : 'w-full'}`}>
                                                            {/* Header bar of expanded row */}
                                                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2 gap-2 flex-wrap">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-extrabold text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                                                                        {resource.name || 'Unnamed Resource'}
                                                                    </span>
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 shadow-sm">
                                                                        <ArrowLeftRight size={11} /> Scroll grid horizontally to view all columns
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={() => toggleExpandRow(resource.id)}
                                                                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white font-semibold flex items-center gap-1"
                                                                >
                                                                    <X size={13} /> Collapse Sub-Sheet
                                                                </button>
                                                            </div>

                                                            <div className={resource.type === 'item' ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "grid grid-cols-1 gap-6"}>
                                                                {/* Section 1: Recipe Ingredients (Composite Items Only) */}
                                                                {resource.type === 'item' && (
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
                                                                                <thead className="bg-gray-100 dark:bg-white/5 text-[10px] uppercase font-bold text-gray-500">
                                                                                    <tr>
                                                                                        <th className="p-2">Component Resource</th>
                                                                                        <th className="p-2 w-20 text-right">Quantity</th>
                                                                                        <th className="p-2 w-20">Unit</th>
                                                                                        <th className="p-2 w-10 text-center">Action</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                                                    {!(Array.isArray(resource.compositions) && resource.compositions.length > 0) ? (
                                                                                        <tr>
                                                                                            <td colSpan="4" className="p-3 text-center text-gray-400 italic text-xs">
                                                                                                No recipe ingredients added yet.
                                                                                            </td>
                                                                                        </tr>
                                                                                    ) : (
                                                                                        (resource.compositions || []).map((comp, cIdx) => (
                                                                                            <tr key={comp.id || cIdx} className="hover:bg-purple-50/30 dark:hover:bg-purple-900/10">
                                                                                                <td className="p-2 font-semibold text-gray-800 dark:text-gray-200">
                                                                                                    {comp.component_name || `Resource #${comp.component_resource_id}`}
                                                                                                </td>
                                                                                                <td className="p-2 font-mono font-bold text-right text-purple-600 dark:text-purple-400">
                                                                                                    {comp.quantity}
                                                                                                </td>
                                                                                                <td className="p-2 font-mono text-gray-500">
                                                                                                    {comp.unit_code}
                                                                                                </td>
                                                                                                <td className="p-2 text-center">
                                                                                                    <button
                                                                                                        onClick={() => handleDeleteInlineComposition(resource.id, comp.id)}
                                                                                                        className="p-1 text-gray-400 hover:text-red-600 rounded transition"
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
                                                                                <div className="p-2 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/10 flex items-center gap-2">
                                                                                    <select
                                                                                        className="flex-1 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded text-xs font-medium text-gray-800 dark:text-white"
                                                                                        value={newCompForm.component_resource_id}
                                                                                        onChange={e => setNewCompForm(prev => ({ ...prev, component_resource_id: e.target.value }))}
                                                                                    >
                                                                                        <option value="">Select component resource...</option>
                                                                                        {resourcesRef.current
                                                                                            .filter(r => String(r.id) !== String(resource.id))
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
                                                                                        className="w-16 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded text-xs font-mono font-bold text-gray-800 dark:text-white"
                                                                                        value={newCompForm.quantity}
                                                                                        onChange={e => setNewCompForm(prev => ({ ...prev, quantity: e.target.value }))}
                                                                                    />
                                                                                    <select
                                                                                        className="w-20 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded text-xs font-medium text-gray-800 dark:text-white"
                                                                                        value={newCompForm.unit_code}
                                                                                        onChange={e => setNewCompForm(prev => ({ ...prev, unit_code: e.target.value }))}
                                                                                    >
                                                                                        {UNIT_OPTIONS.map(u => (
                                                                                            <option key={u.code} value={u.code}>{u.code}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            if (!newCompForm.component_resource_id) {
                                                                                                showToast('error', 'Select Resource', 'Please select a component resource.');
                                                                                                return;
                                                                                            }
                                                                                            handleAddInlineComposition(resource.id, newCompForm.component_resource_id, newCompForm.quantity, newCompForm.unit_code);
                                                                                            setNewCompForm({ component_resource_id: '', quantity: '1', unit_code: 'kg' });
                                                                                        }}
                                                                                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition flex items-center gap-1 shrink-0"
                                                                                    >
                                                                                        <Plus size={12} /> Add
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

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
                                                                            <thead className="bg-gray-100 dark:bg-white/5 text-[10px] uppercase font-bold text-gray-500">
                                                                                <tr>
                                                                                    <th className="p-2">Scale Name</th>
                                                                                    <th className="p-2 w-20 text-right">Quantity</th>
                                                                                    <th className="p-2 w-20">Unit</th>
                                                                                    <th className="p-2 w-10 text-center">Action</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                                                {!(Array.isArray(resource.conversions) && resource.conversions.length > 0) ? (
                                                                                    <tr>
                                                                                        <td colSpan="4" className="p-3 text-center text-gray-400 italic text-xs">
                                                                                            No unit conversion scales added.
                                                                                        </td>
                                                                                    </tr>
                                                                                ) : (
                                                                                    (resource.conversions || []).map((conv, cvIdx) => (
                                                                                        <tr key={conv.id || cvIdx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10">
                                                                                            <td className="p-2 font-semibold text-gray-800 dark:text-gray-200">
                                                                                                1 {conv.name}
                                                                                            </td>
                                                                                            <td className="p-2 font-mono font-bold text-right text-blue-600 dark:text-blue-400">
                                                                                                {conv.quantity}
                                                                                            </td>
                                                                                            <td className="p-2 font-mono text-gray-500">
                                                                                                {conv.unit_code}
                                                                                            </td>
                                                                                            <td className="p-2 text-center">
                                                                                                <button
                                                                                                    onClick={() => handleDeleteInlineConversion(resource.id, conv.id)}
                                                                                                    className="p-1 text-gray-400 hover:text-red-600 rounded transition"
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
                                                                            <div className="p-2 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/10 flex items-center gap-2">
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="Scale (e.g. Box, Pack)"
                                                                                    className="flex-1 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded text-xs font-medium text-gray-800 dark:text-white"
                                                                                    value={newConvForm.name}
                                                                                    onChange={e => setNewConvForm(prev => ({ ...prev, name: e.target.value }))}
                                                                                />
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    placeholder="Qty"
                                                                                    className="w-16 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded text-xs font-mono font-bold text-gray-800 dark:text-white"
                                                                                    value={newConvForm.quantity}
                                                                                    onChange={e => setNewConvForm(prev => ({ ...prev, quantity: e.target.value }))}
                                                                                />
                                                                                <select
                                                                                    className="w-20 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded text-xs font-medium text-gray-800 dark:text-white"
                                                                                    value={newConvForm.unit_code}
                                                                                    onChange={e => setNewConvForm(prev => ({ ...prev, unit_code: e.target.value }))}
                                                                                >
                                                                                    {UNIT_OPTIONS.map(u => (
                                                                                        <option key={u.code} value={u.code}>{u.code}</option>
                                                                                    ))}
                                                                                </select>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        handleAddInlineConversion(resource.id, newConvForm.name, newConvForm.quantity, newConvForm.unit_code);
                                                                                        setNewConvForm({ name: '', quantity: '1', unit_code: 'kg' });
                                                                                    }}
                                                                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition flex items-center gap-1 shrink-0"
                                                                                >
                                                                                    <Plus size={12} /> Add
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
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
                getSubLabel={(row) => [row.code, row.type, row.base_unit_code].filter(Boolean).join(' • ')}
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

export default ResourceList;
