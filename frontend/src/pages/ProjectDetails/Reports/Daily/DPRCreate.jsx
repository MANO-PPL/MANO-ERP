import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Save, Send, Plus, X, Download, Check, ChevronRight, Copy, RotateCcw, Clock, Sparkles, Search } from 'lucide-react';
import { generalDocsApi } from '../../../../services/generalDocsApi';
import { projectApi } from '../../../../services/projectApi';
import { resourceApi } from '../../../../services/resourceApi';
import { customToast } from '../../../../utils/toast';

const MaterialTypeahead = ({ id, value, onChange, onSelectResource, resources, disabled, placeholder, onEnterNext, onKeyDownExtra }) => {
    const [query, setQuery] = useState(value || '');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const containerRef = useRef(null);

    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOrFocusOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                validateAndCommit(query);
            }
        };
        document.addEventListener('mousedown', handleClickOrFocusOutside);
        document.addEventListener('focusin', handleClickOrFocusOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOrFocusOutside);
            document.removeEventListener('focusin', handleClickOrFocusOutside);
        };
    }, [query, resources]);

    const filtered = useMemo(() => {
        if (!resources || resources.length === 0) return [];
        if (!query || query.trim() === '') return resources;
        const q = query.toLowerCase().trim();
        return resources.filter(r => 
            (r.name && r.name.toLowerCase().includes(q)) || 
            (r.code && r.code.toLowerCase().includes(q)) ||
            (r.type && r.type.toLowerCase().includes(q))
        );
    }, [query, resources]);

    const validateAndCommit = (textToValidate) => {
        if (!textToValidate || textToValidate.trim() === '') {
            onChange('');
            onSelectResource(null);
            return;
        }
        const trimmed = textToValidate.trim();
        if (Array.isArray(resources) && resources.length > 0) {
            const exactMatch = resources.find(r => 
                (r.name && r.name.toLowerCase() === trimmed.toLowerCase()) ||
                (r.code && r.code.toLowerCase() === trimmed.toLowerCase())
            );
            if (exactMatch) {
                setQuery(exactMatch.name);
                onChange(exactMatch.name);
                onSelectResource(exactMatch);
                return;
            }
        }
        // Commit typed text so user input is never wiped!
        setQuery(trimmed);
        onChange(trimmed);
    };

    const handleSelect = (item) => {
        setQuery(item.name);
        onChange(item.name);
        onSelectResource(item);
        setIsOpen(false);
    };

    const handleBlur = (e) => {
        if (containerRef.current && containerRef.current.contains(e.relatedTarget)) {
            return;
        }
        setIsOpen(false);
        validateAndCommit(query);
    };

    const handleKeyDown = (e) => {
        // 1. Global row creation shortcut: Ctrl+Enter / Cmd+Enter
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (onKeyDownExtra) onKeyDownExtra(e);
            return;
        }

        // 2. Vertical arrow navigation inside dropdown list
        if (isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                setHighlightIndex(prev => (prev + 1) % Math.max(1, filtered.length));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                setHighlightIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
            }
            return;
        }

        // 3. Enter key: Select highlighted dropdown item, then move focus to next field
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen && filtered.length > 0 && filtered[highlightIndex]) {
                handleSelect(filtered[highlightIndex]);
            } else {
                validateAndCommit(query);
            }
            if (onEnterNext) onEnterNext();
            return;
        }

        if (e.key === 'Escape') {
            setIsOpen(false);
            return;
        }

        if (onKeyDownExtra) {
            onKeyDownExtra(e);
        }
    };

    const isValid = Array.isArray(resources) && resources.some(r => r.name && r.name.toLowerCase() === query.trim().toLowerCase());

    return (
        <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`}>
            <div className="relative flex items-center">
                <input
                    id={id}
                    name={`dpr_mat_${id}`}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        const val = e.target.value;
                        setQuery(val);
                        setIsOpen(true);
                        setHighlightIndex(0);
                        if (onChange) onChange(val);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    placeholder={placeholder || 'Type to search project material...'}
                    className={`w-full bg-transparent outline-none text-xs font-bold placeholder:text-gray-400 dark:placeholder:text-zinc-500 pr-5 ${
                        isValid ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-gray-900 dark:text-white'
                    }`}
                />
                {isValid && (
                    <span className="absolute right-0 text-emerald-500 text-[10px] font-black" title="Valid Material">
                        ✓
                    </span>
                )}
            </div>

            {isOpen && !disabled && (
                filtered.length > 0 ? (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto bg-white dark:bg-[#1f242c] border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 text-xs">
                        {filtered.map((item, idx) => (
                            <div
                                key={item.project_resource_id || item.resource_id || item.id || idx}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    handleSelect(item);
                                    if (onEnterNext) onEnterNext();
                                }}
                                className={`px-2.5 py-1.5 cursor-pointer flex items-center justify-between transition-colors ${
                                    idx === highlightIndex
                                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold'
                                        : 'hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-800 dark:text-gray-200'
                                }`}
                            >
                                <div className="flex flex-col">
                                    <span className="font-bold">{item.name}</span>
                                    {item.code && <span className="text-[9px] text-gray-400 font-mono">[{item.code}]</span>}
                                </div>
                                <div className="flex items-center space-x-1.5">
                                    {item.type && (
                                        <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500">
                                            {item.type}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                                        {item.base_unit_code || item.unit || '—'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : resources.length === 0 ? (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-[#1f242c] border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl px-3 py-2 text-[11px] text-gray-400 text-center font-medium">
                        No project materials found. Add materials in Project Resources first.
                    </div>
                ) : query.trim().length > 0 ? (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-[#1f242c] border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl px-3 py-2 text-xs text-gray-400 text-center font-medium">
                        No matching project material found
                    </div>
                ) : null
            )}
        </div>
    );
};

const DEFAULT_TRADES = [
    { key: 'super', label: 'Super' },
    { key: 'carp', label: 'Carp' },
    { key: 'fitter', label: 'Fitter' },
    { key: 'elect', label: 'Elect' },
    { key: 'opera', label: 'Opera' },
    { key: 'mason', label: 'Mason' },
    { key: 'labou', label: 'Labou' },
    { key: 'storel', label: 'Store' },
    { key: 'staff', label: 'Staff' },
    { key: 'plumber', label: 'Plumb' }
];

const PROGRESS_KEYS = ['todayItem', 'todayDesc', 'todayUnit', 'todayQty', 'tomorrowItem', 'tomorrowDesc', 'tomorrowUnit', 'tomorrowQty'];

const DPRCreate = ({ onBack, initialData = null, isReadOnly = false, project = null, onSave }) => {
    const projectId = project?.id || project?.dbId || 'default';
    const storageKey = `dpr_config_${projectId}`;

    // Load Configured Trades & Presets from localStorage
    const [configuredTrades] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.trades && parsed.trades.length > 0) return parsed.trades;
            }
        } catch (err) {}
        return DEFAULT_TRADES;
    });

    const [configuredDistributions] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.distributions && parsed.distributions.length > 0) return parsed.distributions;
            }
        } catch (err) {}
        return ['GLOWMEX', 'MANO CPL', 'CLIENT'];
    });

    const [configuredPreparedBys] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.preparedBys && parsed.preparedBys.length > 0) return parsed.preparedBys;
            }
        } catch (err) {}
        return ['MANO CPL', 'SITE ENGINEER', 'PROJECT DIRECTOR'];
    });

    const LABOUR_KEYS = configuredTrades.map(t => t.key);
    const LABOUR_LABELS = configuredTrades.map(t => t.label);

    const mapInitialLabourData = (data) => {
        if (!data || data.length === 0) return null;
        return data.map(row => {
            const mapped = { agency: row.agency || '', remarks: row.remarks || '' };
            LABOUR_KEYS.forEach(key => {
                mapped[key] = row[key] || 0;
            });
            return mapped;
        });
    };

    const mapInitialProgressData = (data) => {
        if (data?.progressRows && data.progressRows.length > 0) {
            return data.progressRows;
        }
        const today = data?.todayProgress || [];
        const tomorrow = data?.tomorrowPlan || [];
        const len = Math.max(today.length, tomorrow.length);
        if (len === 0) return null;
        const merged = [];
        for (let i = 0; i < len; i++) {
            merged.push({
                todayItem: today[i]?.item || '',
                todayDesc: today[i]?.description || '',
                todayUnit: today[i]?.unit || '',
                todayQty: today[i]?.qty || '',
                tomorrowItem: tomorrow[i]?.item || '',
                tomorrowDesc: tomorrow[i]?.description || '',
                tomorrowUnit: tomorrow[i]?.unit || '',
                tomorrowQty: tomorrow[i]?.qty || ''
            });
        }
        return merged;
    };

    // 1. Lock Report Date to Today's date (or initialData.date for viewing existing reports)
    const todayStr = new Date().toISOString().split('T')[0];
    const reportDate = initialData?.date || todayStr;

    const formatDateToExcel = (dateInput) => {
        if (!dateInput) return '—';
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return dateInput;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const calculateMetrics = (selectedDate) => {
        const start = new Date(project?.start_date || project?.metadata?.startDate || '2026-07-01');
        const end = new Date(project?.end_date || project?.metadata?.endDate || '2026-07-31');
        const report = new Date(selectedDate);
        
        const total = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const elapsed = Math.max(0, Math.ceil((report.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const balance = Math.max(0, total - elapsed);
        
        return { total, passed: elapsed, balance, start, end };
    };

    const metrics = calculateMetrics(reportDate);

    // Fetch Project Parties & Project Resources
    const [projectParties, setProjectParties] = useState([]);
    const [projectResources, setProjectResources] = useState([]);

    const selectableAgencies = useMemo(() => {
        const partyNames = (projectParties || [])
            .filter(party => {
                const cat = String(party.category || party.contact_category || party.party_category || party.type || '').toLowerCase().trim();
                return cat !== 'client';
            })
            .map(party => party.name || party.party_name)
            .filter(Boolean);

        return [...new Set(partyNames)];
    }, [projectParties]);

    useEffect(() => {
        const getProjectId = () => {
            if (project?.id && project.id !== 'default') return project.id;
            if (project?.dbId && project.dbId !== 'default') return project.dbId;
            if (project?._id && project._id !== 'default') return project._id;
            const match = window.location.pathname.match(/\/projects\/([^\/]+)/);
            if (match && match[1] && match[1] !== 'default') return match[1];
            return null;
        };

        const pId = getProjectId();

        const fetchVendors = async () => {
            if (!pId) return;
            try {
                const res = await generalDocsApi.getParties(pId);
                if (res && res.parties) {
                    setProjectParties(res.parties);
                }
            } catch (err) {
                console.error('Failed to fetch project parties:', err);
            }
        };

        const fetchResources = async () => {
            if (!pId) {
                setProjectResources([]);
                return;
            }
            try {
                const projRes = await projectApi.listProjectResources(pId);
                const projList = projRes?.resources || projRes?.data || (Array.isArray(projRes) ? projRes : []);
                if (Array.isArray(projList)) {
                    const cleanList = projList
                        .filter(item => {
                            const t = String(item.type || item.resource_type || '').toLowerCase().trim();
                            return t === 'item' || t === 'work';
                        })
                        .map(item => ({
                            ...item,
                            name: item.name || item.resource_name || '',
                            code: item.code || item.resource_code || '',
                            type: item.type || item.resource_type || 'ITEM',
                            base_unit_code: item.base_unit_code || item.unit || item.rate_unit_code || ''
                        }))
                        .filter(item => item.name && item.name.trim() !== '');
                    setProjectResources(cleanList);
                    return;
                }
                setProjectResources([]);
            } catch (err) {
                console.error('Failed to fetch project resources:', err);
                setProjectResources([]);
            }
        };

        fetchVendors();
        fetchResources();
    }, [project]);

    // Stepper State Navigation
    const steps = [
        { id: 'project', label: 'Project & Site', desc: 'Hours, weather & duration' },
        { id: 'labour', label: 'Labour Report', desc: 'Headcount by agency' },
        { id: 'progress', label: 'Progress & Plan', desc: 'Today & tomorrow activities' },
        { id: 'review', label: 'Events & Review', desc: 'Notes, sign-offs & finalize' }
    ];
    const [activeStepIndex, setActiveStepIndex] = useState(0);

    // 2. Weather & Dynamic Rain Stoppage Time Slots State
    const [weather, setWeather] = useState(initialData?.weather === 'rainy' ? 'rainy' : 'sunny');
    const [siteCondition, setSiteCondition] = useState(initialData?.siteCondition || 'dry');
    const [location, setLocation] = useState(() => initialData?.location || project?.location || project?.metadata?.location || 'Lubumbashi, Congo');
    
    const [timeSlots, setTimeSlots] = useState(() => {
        if (initialData?.timeSlots && initialData.timeSlots.length > 0) {
            return initialData.timeSlots.map(ts => ({ from: ts.from || '', to: ts.to || '' }));
        }
        return [
            { from: '08:00', to: '17:30' }
        ];
    });

    const updateTimeSlot = (idx, field, val) => {
        const updated = [...timeSlots];
        updated[idx][field] = val;
        setTimeSlots(updated);
    };

    const addTimeSlot = () => {
        setTimeSlots([...timeSlots, { from: '', to: '' }]);
    };

    const deleteTimeSlot = (idx) => {
        if (timeSlots.length <= 1) return;
        setTimeSlots(timeSlots.filter((_, i) => i !== idx));
    };

    // 3. Labour Grid State & Selection Navigation (Excel-style)
    const defaultLabour = [
        { agency: '', plumber: 0, super: 0, carp: 0, fitter: 0, elect: 0, opera: 0, mason: 0, labou: 0, storel: 0, staff: 0, remarks: '' }
    ];

    const [labourRows, setLabourRows] = useState(() => {
        const mapped = mapInitialLabourData(initialData?.labourData);
        if (mapped) return mapped;

        return defaultLabour.map(r => {
            const row = { agency: r.agency, remarks: r.remarks };
            LABOUR_KEYS.forEach(k => {
                row[k] = r[k] !== undefined ? r[k] : 0;
            });
            return row;
        });
    });

    // Selected cell: { agencyIdx, tradeIdx } — agencyIdx is labour row, tradeIdx is index in LABOUR_KEYS
    const [selectedCell, setSelectedCell] = useState(null);
    const [isEditingCell, setIsEditingCell] = useState(false);

    const [cumulativeLastDay, setCumulativeLastDay] = useState(initialData?.cumulativeLastDay || 3467);

    const getRowTotal = (row) => {
        return LABOUR_KEYS.reduce((sum, key) => sum + (parseInt(row[key]) || 0), 0);
    };

    const getColTotal = (key) => {
        return labourRows.reduce((sum, row) => sum + (parseInt(row[key]) || 0), 0);
    };

    const getTotalManpowerToday = () => {
        return labourRows.reduce((sum, row) => sum + getRowTotal(row), 0);
    };

    const cumulativeUpToDate = (parseInt(cumulativeLastDay) || 0) + getTotalManpowerToday();

    const updateLabourRow = (idx, field, val) => {
        const updated = [...labourRows];
        if (LABOUR_KEYS.includes(field)) {
            updated[idx][field] = val === '' ? '' : Math.max(0, parseInt(val) || 0);
        } else {
            updated[idx][field] = val;
        }
        setLabourRows(updated);
    };

    // Excel cell handlers
    const handleCellClick = (agencyIdx, tradeIdx) => {
        if (isReadOnly) return;
        if (selectedCell?.agencyIdx === agencyIdx && selectedCell?.tradeIdx === tradeIdx) {
            // Second click on already-selected cell → enter edit
            setIsEditingCell(true);
            return;
        }
        setSelectedCell({ agencyIdx, tradeIdx });
        setIsEditingCell(false);
    };

    // Keyboard Navigation for Labour Grid — no +/- adjustment, only direct typed entry
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selectedCell || isReadOnly || activeStepIndex !== 1) return;

            const { agencyIdx, tradeIdx } = selectedCell;
            const currentKey = LABOUR_KEYS[tradeIdx];
            const COLS = 3; // 3 trades per row in the card grid
            const totalTrades = LABOUR_KEYS.length;
            const rowInCard = Math.floor(tradeIdx / COLS);
            const colInCard = tradeIdx % COLS;
            const totalRows = Math.ceil(totalTrades / COLS);

            if (isEditingCell) {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditingCell(false);
                }
                // All other keys pass through to the input naturally
                return;
            }

            // Don't hijack when typing in agency select or remarks inputs
            if (['SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (e.target.tagName === 'INPUT' && !e.target.classList.contains('excel-cell-input')) return;

            switch (e.key) {
                case 'ArrowUp': {
                    e.preventDefault();
                    if (rowInCard > 0) {
                        // Move up within same card
                        setSelectedCell({ agencyIdx, tradeIdx: (rowInCard - 1) * COLS + colInCard });
                    } else if (agencyIdx > 0) {
                        // Jump to last row of previous card, same column
                        const prevTrades = LABOUR_KEYS.length;
                        const prevLastRow = Math.ceil(prevTrades / COLS) - 1;
                        const newIdx = Math.min(prevLastRow * COLS + colInCard, prevTrades - 1);
                        setSelectedCell({ agencyIdx: agencyIdx - 1, tradeIdx: newIdx });
                    }
                    break;
                }
                case 'ArrowDown': {
                    e.preventDefault();
                    if (rowInCard < totalRows - 1) {
                        const newIdx = Math.min((rowInCard + 1) * COLS + colInCard, totalTrades - 1);
                        setSelectedCell({ agencyIdx, tradeIdx: newIdx });
                    } else if (agencyIdx < labourRows.length - 1) {
                        // Jump to first row of next card, same column
                        const newIdx = Math.min(colInCard, totalTrades - 1);
                        setSelectedCell({ agencyIdx: agencyIdx + 1, tradeIdx: newIdx });
                    }
                    break;
                }
                case 'ArrowLeft': {
                    e.preventDefault();
                    if (tradeIdx > 0) setSelectedCell({ agencyIdx, tradeIdx: tradeIdx - 1 });
                    break;
                }
                case 'ArrowRight': {
                    e.preventDefault();
                    if (tradeIdx < totalTrades - 1) setSelectedCell({ agencyIdx, tradeIdx: tradeIdx + 1 });
                    break;
                }
                case 'Enter': {
                    e.preventDefault();
                    setIsEditingCell(true);
                    break;
                }
                case 'Backspace':
                case 'Delete': {
                    e.preventDefault();
                    updateLabourRow(agencyIdx, currentKey, 0);
                    break;
                }
                default:
                    // Direct digit entry: start edit with that digit
                    if (/^[0-9]$/.test(e.key)) {
                        e.preventDefault();
                        updateLabourRow(agencyIdx, currentKey, parseInt(e.key, 10));
                        setIsEditingCell(true);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedCell, isEditingCell, labourRows, isReadOnly, activeStepIndex]);

    const addLabourRow = () => {
        const newRow = { agency: '', remarks: '' };
        LABOUR_KEYS.forEach(k => { newRow[k] = 0; });
        setLabourRows(prev => [...prev, newRow]);
    };

    const deleteLabourRow = (idx) => {
        setLabourRows(labourRows.filter((_, i) => i !== idx));
    };

    // 4. Independent Today's Progress & Tomorrow's Planning State
    const defaultTodayRows = [
        { item: '', description: '', unit: '', qty: '' }
    ];

    const defaultTomorrowRows = [
        { item: '', description: '', unit: '', qty: '' }
    ];

    const [todayRows, setTodayRows] = useState(() => {
        if (initialData?.todayProgress && initialData.todayProgress.length > 0) {
            return initialData.todayProgress.map(r => ({ item: r.item || '', description: r.description || '', unit: r.unit || '', qty: r.qty || '' }));
        }
        if (initialData?.progressRows && initialData.progressRows.length > 0) {
            return initialData.progressRows.map(r => ({ item: r.todayItem || '', description: r.todayDesc || '', unit: r.todayUnit || '', qty: r.todayQty || '' }));
        }
        return defaultTodayRows;
    });

    const [tomorrowRows, setTomorrowRows] = useState(() => {
        if (initialData?.tomorrowPlan && initialData.tomorrowPlan.length > 0) {
            return initialData.tomorrowPlan.map(r => ({ item: r.item || '', description: r.description || '', unit: r.unit || '', qty: r.qty || '' }));
        }
        if (initialData?.progressRows && initialData.progressRows.length > 0) {
            return initialData.progressRows.map(r => ({ item: r.tomorrowItem || '', description: r.tomorrowDesc || '', unit: r.tomorrowUnit || '', qty: r.tomorrowQty || '' }));
        }
        return defaultTomorrowRows;
    });

    const updateTodayRow = (idx, field, val) => {
        setTodayRows(prev => {
            const updated = [...prev];
            if (!updated[idx]) return prev;
            updated[idx] = { ...updated[idx], [field]: val };
            if (field === 'item') {
                const matchedResource = projectResources.find(r => 
                    (r.name && r.name.toLowerCase() === val.toLowerCase()) || 
                    (r.code && r.code.toLowerCase() === val.toLowerCase())
                );
                updated[idx].unit = matchedResource ? (matchedResource.base_unit_code || matchedResource.unit || '') : updated[idx].unit;
            }
            return updated;
        });
    };

    const addTodayRow = () => {
        setTodayRows(prev => [...prev, { item: '', description: '', unit: '', qty: '' }]);
    };

    const deleteTodayRow = (idx) => {
        setTodayRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
    };

    const updateTomorrowRow = (idx, field, val) => {
        setTomorrowRows(prev => {
            const updated = [...prev];
            if (!updated[idx]) return prev;
            updated[idx] = { ...updated[idx], [field]: val };
            if (field === 'item') {
                const matchedResource = projectResources.find(r => 
                    (r.name && r.name.toLowerCase() === val.toLowerCase()) || 
                    (r.code && r.code.toLowerCase() === val.toLowerCase())
                );
                updated[idx].unit = matchedResource ? (matchedResource.base_unit_code || matchedResource.unit || '') : updated[idx].unit;
            }
            return updated;
        });
    };

    const addTomorrowRow = () => {
        setTomorrowRows(prev => [...prev, { item: '', description: '', unit: '', qty: '' }]);
    };

    const deleteTomorrowRow = (idx) => {
        setTomorrowRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
    };

    const copyTodayToTomorrow = () => {
        setTomorrowRows(todayRows.map(r => ({ ...r })));
        customToast.info("Copied Today's Progress to Tomorrow's Plan", 'Copied');
    };

    const handleStep3FieldKeyDown = (e, section, rIdx, field) => {
        // 1. Shortcut: Ctrl+Enter (Win) or Cmd+Enter (Mac) -> Add new activity row
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (section === 'today') {
                const nextIdx = todayRows.length;
                addTodayRow();
                setTimeout(() => {
                    const el = document.getElementById(`today-item-${nextIdx}`);
                    if (el) el.focus();
                }, 60);
            } else {
                const nextIdx = tomorrowRows.length;
                addTomorrowRow();
                setTimeout(() => {
                    const el = document.getElementById(`tomorrow-item-${nextIdx}`);
                    if (el) el.focus();
                }, 60);
            }
            return;
        }

        // 2. Enter key flow: item -> description -> qty -> next row item
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (field === 'item') {
                const descEl = document.getElementById(`${section}-desc-${rIdx}`);
                if (descEl) descEl.focus();
            } else if (field === 'description') {
                const qtyEl = document.getElementById(`${section}-qty-${rIdx}`);
                if (qtyEl) qtyEl.focus();
            } else if (field === 'qty') {
                const rows = section === 'today' ? todayRows : tomorrowRows;
                if (rIdx < rows.length - 1) {
                    const nextItemEl = document.getElementById(`${section}-item-${rIdx + 1}`);
                    if (nextItemEl) nextItemEl.focus();
                } else {
                    // On last row qty, pressing Enter adds a new row and moves focus to it
                    if (section === 'today') {
                        const nextIdx = rows.length;
                        addTodayRow();
                        setTimeout(() => {
                            const el = document.getElementById(`today-item-${nextIdx}`);
                            if (el) el.focus();
                        }, 60);
                    } else {
                        const nextIdx = rows.length;
                        addTomorrowRow();
                        setTimeout(() => {
                            const el = document.getElementById(`tomorrow-item-${nextIdx}`);
                            if (el) el.focus();
                        }, 60);
                    }
                }
            }
        }

        // 3. ArrowUp / ArrowDown navigation between rows for description & qty
        if (e.key === 'ArrowDown') {
            const rows = section === 'today' ? todayRows : tomorrowRows;
            if (rIdx < rows.length - 1) {
                e.preventDefault();
                const nextEl = document.getElementById(`${section}-${field}-${rIdx + 1}`);
                if (nextEl) nextEl.focus();
            }
        } else if (e.key === 'ArrowUp') {
            if (rIdx > 0) {
                e.preventDefault();
                const prevEl = document.getElementById(`${section}-${field}-${rIdx - 1}`);
                if (prevEl) prevEl.focus();
            }
        }
    };

    // 5. Dynamic Events & Remarks State
    const [eventsList, setEventsList] = useState(() => {
        if (initialData?.eventsList && initialData.eventsList.length > 0) {
            return initialData.eventsList;
        }
        return ['', '', ''];
    });

    const [remarksList, setRemarksList] = useState(() => {
        if (initialData?.remarksList && initialData.remarksList.length > 0) {
            return initialData.remarksList;
        }
        return ['', '', ''];
    });

    const addEventRow = () => {
        setEventsList([...eventsList, '']);
    };

    const deleteEventRow = (idx) => {
        if (eventsList.length <= 1) return;
        setEventsList(eventsList.filter((_, i) => i !== idx));
    };

    const addRemarkRow = () => {
        setRemarksList([...remarksList, '']);
    };

    const deleteRemarkRow = (idx) => {
        if (remarksList.length <= 1) return;
        setRemarksList(remarksList.filter((_, i) => i !== idx));
    };

    const [distribution, setDistribution] = useState(initialData?.distribution || configuredDistributions[0] || 'GLOWMEX');
    const [preparedBy, setPreparedBy] = useState(initialData?.preparedBy || configuredPreparedBys[0] || 'MANO CPL');

    const handleCopyYesterdaySite = () => {
        setTimeSlots([{ from: '08:00', to: '17:30' }]);
        setWeather('sunny');
        setSiteCondition('dry');
        customToast.info('Site hours & weather copied from yesterday', 'Copied');
    };

    const handleCopyYesterdayLabour = () => {
        setLabourRows([
            { agency: 'MANO PMC', plumber: 0, super: 0, carp: 0, fitter: 0, elect: 0, opera: 0, mason: 0, labou: 0, storel: 0, staff: 3, remarks: '' },
            { agency: 'Departmental (Ind)', plumber: 1, super: 2, carp: 3, fitter: 3, elect: 1, opera: 0, mason: 0, labou: 0, storel: 1, staff: 0, remarks: '' },
            { agency: 'Departmental (Con)', plumber: 0, super: 1, carp: 4, fitter: 4, elect: 3, opera: 1, mason: 1, labou: 37, storel: 2, staff: 0, remarks: '' }
        ]);
        customToast.info('Agencies & headcounts copied from yesterday', 'Copied');
    };

    const handleFinalize = () => {
        const totalWorkers = getTotalManpowerToday();
        const activeTodayTasks = todayRows.filter(r => r.item).map(r => r.item).join(', ');
        const summaryText = activeTodayTasks 
            ? `${activeTodayTasks} in progress. Total daily manpower: ${totalWorkers} personnel on site.`
            : `Site works progressing as planned. Total daily manpower: ${totalWorkers} personnel on site.`;

        const newReport = {
            id: initialData?.id || Date.now(),
            date: reportDate,
            summary: summaryText,
            completion: 100,
            personnel: totalWorkers,
            readiness: 'Optimal',
            audit: {
                createdAt: initialData?.audit?.createdAt || new Date().toISOString(),
                createdBy: initialData?.audit?.createdBy || preparedBy,
                lastUpdated: new Date().toISOString(),
                formTiming: '12 mins',
                approval: {
                    status: 'Approved',
                    by: 'Project Director',
                    date: new Date().toISOString()
                }
            },
            weather,
            siteCondition,
            timeSlots: timeSlots.map((ts, idx) => ({ id: idx + 1, from: ts.from, to: ts.to })),
            labourData: labourRows,
            cumulativeLastDay: parseInt(cumulativeLastDay) || 0,
            todayProgress: todayRows.filter(r => r.item || r.description),
            tomorrowPlan: tomorrowRows.filter(r => r.item || r.description),
            eventsList: eventsList.filter(Boolean),
            remarksList: remarksList.filter(Boolean),
            distribution,
            preparedBy,
            generalRemarks: remarksList.filter(Boolean).join('\n') || 'Day progressed as scheduled. No safety incidents.'
        };

        if (onSave) {
            onSave(newReport);
        } else {
            onBack();
        }
    };

    const systemAgencies = ['MANO PMC', 'Departmental (Ind)', 'Departmental (Con)'];

    return (
        <div className="flex flex-col h-full bg-[#F6F3EC] dark:bg-[#0b0e14] text-gray-800 dark:text-gray-200 w-full font-sans select-text overflow-hidden">
            
            {/* TOP BAR */}
            <header className="h-16 bg-white dark:bg-[#161b22] border-b border-[#E4E0D4] dark:border-zinc-800 px-6 flex items-center justify-between z-30 shadow-sm flex-shrink-0">
                <div className="flex items-center space-x-3">
                    <button 
                        onClick={onBack}
                        className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-600 font-bold">
                            <Sparkles size={16} />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                                {isReadOnly ? 'Daily Progress Report View' : 'New Daily Progress Report'}
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">
                                {project?.name || 'Metro Line Extension Project'} <span className="mx-1.5 text-gray-300">·</span> {project?.project_code || 'METRO-X'} <span className="mx-1.5 text-gray-300">·</span> {formatDateToExcel(reportDate)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="hidden sm:flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Saved just now</span>
                    </div>

                    <button 
                        onClick={onBack}
                        className="px-4 py-2 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg text-xs font-semibold border border-gray-300 dark:border-zinc-700 transition-all"
                    >
                        Cancel
                    </button>

                    {!isReadOnly && (
                        <button 
                            onClick={handleFinalize}
                            className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-md shadow-orange-500/20 flex items-center space-x-1.5 active:scale-95 transition-all"
                        >
                            <Send size={14} />
                            <span>Generate & Save</span>
                        </button>
                    )}
                </div>
            </header>

            {/* 2-SECTION WORKSPACE LAYOUT */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[450px_1fr] gap-6 p-6 overflow-hidden max-w-[1900px] w-full mx-auto">

                {/* SECTION 1: EDITOR SECTION (LEFT PANEL WITH EXCEL-STYLE LABOUR GRID) */}
                <main className="bg-white dark:bg-[#161b22] border border-[#E4E0D4] dark:border-zinc-800 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
                    
                    {/* EMBEDDED HORIZONTAL STEPPER BAR */}
                    <div className="px-4 py-3 border-b border-[#E4E0D4] dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/60 flex-shrink-0">
                        <div className="grid grid-cols-2 gap-1.5">
                            {steps.map((step, idx) => {
                                const isCurrent = activeStepIndex === idx;
                                const isDone = activeStepIndex > idx;

                                return (
                                    <button
                                        key={step.id}
                                        onClick={() => setActiveStepIndex(idx)}
                                        className={`flex items-center space-x-2 p-2 rounded-lg text-left transition-all border ${
                                            isCurrent 
                                                ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-500/60 text-orange-600 dark:text-orange-400 shadow-sm' 
                                                : isDone 
                                                    ? 'bg-white dark:bg-zinc-900 border-emerald-500/30 text-gray-800 dark:text-zinc-200'
                                                    : 'bg-white/60 dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800 text-gray-400 dark:text-zinc-500 hover:bg-white dark:hover:bg-zinc-900'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                                            isDone 
                                                ? 'bg-emerald-500 text-white' 
                                                : isCurrent 
                                                    ? 'bg-orange-600 text-white' 
                                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 border border-gray-300 dark:border-zinc-700'
                                        }`}>
                                            {isDone ? <Check size={10} /> : idx + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-[11px] font-bold truncate ${isCurrent ? 'text-orange-600 dark:text-orange-400' : 'text-gray-800 dark:text-zinc-200'}`}>
                                                {step.label}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step Content Wrapper */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                        
                        {/* STEP 1: PROJECT & SITE — CLEANED UP */}
                        {activeStepIndex === 0 && (
                            <section className="space-y-4 anim-fade-in">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                                        Site Conditions
                                    </h2>
                                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                                        Set today's weather, site condition, and log any rain stoppage windows.
                                    </p>
                                </div>

                                {/* Date badge + Copy Banner */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Report Date</span>
                                        <span className="px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-xs font-black text-gray-900 dark:text-white">{formatDateToExcel(reportDate)}</span>
                                    </div>
                                    {!isReadOnly && (
                                        <button 
                                            onClick={handleCopyYesterdaySite}
                                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all"
                                        >
                                            <Copy size={11} />
                                            <span>Copy yesterday</span>
                                        </button>
                                    )}
                                </div>



                                 <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1.5">
                                            Day type
                                        </label>
                                        <div className="flex items-center space-x-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setWeather('sunny')}
                                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center space-x-1 border transition-all ${
                                                    weather === 'sunny' 
                                                        ? 'bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400' 
                                                        : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'
                                                }`}
                                            >
                                                {weather === 'sunny' && <Check size={11} />}
                                                <span>Normal Day</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setWeather('rainy')}
                                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center space-x-1 border transition-all ${
                                                    weather === 'rainy' 
                                                        ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400' 
                                                        : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'
                                                }`}
                                            >
                                                {weather === 'rainy' && <Check size={11} />}
                                                <span>Rainy</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1.5">
                                            Site conditions
                                        </label>
                                        <div className="flex items-center space-x-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setSiteCondition('dry')}
                                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center space-x-1 border transition-all ${
                                                    siteCondition === 'dry' 
                                                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                                                        : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'
                                                }`}
                                            >
                                                {siteCondition === 'dry' && <Check size={11} />}
                                                <span>Dry</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSiteCondition('slushy')}
                                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center space-x-1 border transition-all ${
                                                    siteCondition === 'slushy' 
                                                        ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400' 
                                                        : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'
                                                }`}
                                            >
                                                {siteCondition === 'slushy' && <Check size={11} />}
                                                <span>Slushy</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Rain Stoppage Time Sessions */}
                                <div className="space-y-2 pt-1 border-t border-gray-200 dark:border-zinc-800">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300">
                                            Work Stoppage / Rain Sessions ({timeSlots.length})
                                        </label>
                                        {!isReadOnly && (
                                            <button 
                                                onClick={addTimeSlot} 
                                                className="text-[10px] text-blue-600 hover:text-blue-800 dark:text-blue-400 font-bold flex items-center"
                                            >
                                                <Plus size={11} className="mr-0.5" /> Add Time Slot
                                            </button>
                                        )}
                                    </div>
                                    {timeSlots.map((ts, idx) => (
                                        <div key={idx} className="flex items-center space-x-2 bg-gray-50 dark:bg-zinc-900 p-2 rounded-lg border border-gray-200 dark:border-zinc-800">
                                            {!isReadOnly && timeSlots.length > 1 && (
                                                <button onClick={() => deleteTimeSlot(idx)} className="text-red-500 hover:text-red-700 font-bold text-xs">
                                                    ×
                                                </button>
                                            )}
                                            <span className="text-[10px] font-bold text-gray-400">From:</span>
                                            <input 
                                                type="text" 
                                                value={ts.from} 
                                                onChange={(e) => updateTimeSlot(idx, 'from', e.target.value)} 
                                                placeholder="08:00"
                                                disabled={isReadOnly}
                                                className="w-16 px-2 py-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-xs font-bold text-center"
                                            />
                                            <span className="text-[10px] font-bold text-gray-400">To:</span>
                                            <input 
                                                type="text" 
                                                value={ts.to} 
                                                onChange={(e) => updateTimeSlot(idx, 'to', e.target.value)} 
                                                placeholder="17:30"
                                                disabled={isReadOnly}
                                                className="w-16 px-2 py-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-xs font-bold text-center"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-1">
                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1.5">
                                        Duration Metrics
                                    </label>
                                    <div className="grid grid-cols-3 gap-2.5">
                                        <div className="p-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-center">
                                            <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase font-bold tracking-wider">Total</p>
                                            <p className="text-base font-black text-gray-900 dark:text-white mt-0.5">{metrics.total}</p>
                                        </div>
                                        <div className="p-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-center">
                                            <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase font-bold tracking-wider">Elapsed</p>
                                            <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">{metrics.passed}</p>
                                        </div>
                                        <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-center">
                                            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider">Balance</p>
                                            <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{metrics.balance}</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* STEP 2: LABOUR REPORT — CARD-PER-AGENCY, PURE EXCEL-STYLE, NO +/- BUTTONS */}
                        {activeStepIndex === 1 && (
                            <section className="space-y-4 anim-fade-in">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                                        Labour Report
                                    </h2>
                                    {/* Keyboard hint */}
                                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                                        {[
                                            { key: 'Click', hint: 'Select cell' },
                                            { key: 'Enter', hint: 'Edit & type value' },
                                            { key: 'Enter / Esc', hint: 'Confirm & exit' },
                                            { key: '↑ ↓ ← →', hint: 'Navigate' },
                                        ].map(({ key, hint }) => (
                                            <span key={key} className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500">
                                                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-[9px] font-bold text-gray-600 dark:text-zinc-300">{key}</kbd>
                                                <span>{hint}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Copy Banner */}
                                {!isReadOnly && (
                                    <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-center justify-between">
                                        <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                                            Yesterday: 67 manpower across 3 agencies.
                                        </p>
                                        <button 
                                            onClick={handleCopyYesterdayLabour}
                                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all"
                                        >
                                            <Copy size={11} />
                                            <span>Copy counts</span>
                                        </button>
                                    </div>
                                )}

                                {/* CARD-PER-AGENCY EXCEL GRID */}
                                <div className="space-y-3">
                                    {labourRows.map((row, agencyIdx) => (
                                        <div
                                            key={agencyIdx}
                                            className="bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm"
                                        >
                                            {/* Card Header — Agency selector + total + delete */}
                                            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700">
                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                    {!isReadOnly && (
                                                        <button
                                                            onClick={() => deleteLabourRow(agencyIdx)}
                                                            className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                                                            title="Remove agency"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                    {isReadOnly ? (
                                                        <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{row.agency || '—'}</span>
                                                    ) : (
                                                        <select
                                                            value={row.agency}
                                                            onChange={(e) => updateLabourRow(agencyIdx, 'agency', e.target.value)}
                                                            className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-gray-900 dark:text-white cursor-pointer min-w-0 truncate"
                                                        >
                                                            <option value="">— Select Agency —</option>
                                                            {row.agency && !selectableAgencies.includes(row.agency) && (
                                                                <option value={row.agency}>{row.agency}</option>
                                                            )}
                                                            {selectableAgencies.map(agencyName => (
                                                                <option key={agencyName} value={agencyName}>{agencyName}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                                <div className="flex-shrink-0 flex items-center space-x-1.5 ml-2">
                                                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium">Total</span>
                                                    <span className="text-lg font-black text-orange-500 leading-none">{getRowTotal(row)}</span>
                                                </div>
                                            </div>

                                            {/* Trade Tally Grid — 3 columns, no +/- buttons */}
                                            <div className="p-2 grid grid-cols-3 gap-1">
                                                {LABOUR_KEYS.map((key, tIdx) => {
                                                    const isSelected = selectedCell?.agencyIdx === agencyIdx && selectedCell?.tradeIdx === tIdx;
                                                    const isEditingThis = isSelected && isEditingCell;
                                                    const val = parseInt(row[key]) || 0;

                                                    return (
                                                        <div
                                                            key={key}
                                                            onClick={() => handleCellClick(agencyIdx, tIdx)}
                                                            className={`flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-all select-none border ${
                                                                isSelected
                                                                    ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 ring-1 ring-orange-400'
                                                                    : 'bg-gray-50 dark:bg-zinc-900/60 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                                            }`}
                                                        >
                                                            <span className={`text-[10px] font-semibold truncate mr-1 ${
                                                                isSelected ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-zinc-400'
                                                            }`}>
                                                                {LABOUR_LABELS[tIdx]}
                                                            </span>
                                                            {isEditingThis ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    autoFocus
                                                                    value={val === 0 ? '' : val}
                                                                    onChange={(e) => updateLabourRow(agencyIdx, key, e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' || e.key === 'Escape') {
                                                                            e.preventDefault();
                                                                            e.stopPropagation(); // prevent global handler re-entering edit mode
                                                                            setIsEditingCell(false);
                                                                        }
                                                                    }}
                                                                    onBlur={() => setIsEditingCell(false)}
                                                                    className="excel-cell-input w-10 text-center bg-white dark:bg-zinc-900 border border-orange-400 outline-none rounded text-xs font-black text-gray-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            ) : (
                                                                <span className={`text-sm font-black w-10 text-right ${
                                                                    val > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-zinc-600'
                                                                }`}>
                                                                    {val > 0 ? val : '—'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Remarks per agency */}
                                            <div className="px-3 pb-2.5">
                                                {isReadOnly ? (
                                                    row.remarks ? <p className="text-xs text-gray-500 dark:text-zinc-400 italic">{row.remarks}</p> : null
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={row.remarks}
                                                        onChange={(e) => updateLabourRow(agencyIdx, 'remarks', e.target.value)}
                                                        placeholder="Agency remarks (optional)..."
                                                        className="w-full px-2 py-1 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs text-gray-700 dark:text-zinc-300 outline-none focus:border-orange-400 placeholder:text-gray-300 dark:placeholder:text-zinc-600"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {!isReadOnly && (
                                    <button
                                        onClick={addLabourRow}
                                        className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-orange-500 text-gray-500 dark:text-zinc-400 hover:text-orange-500 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all"
                                    >
                                        <Plus size={13} />
                                        <span>Add Agency</span>
                                    </button>
                                )}

                                {/* Manpower Totals Strip */}
                                <div className="p-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Today's Manpower</p>
                                        <p className="text-xl font-black text-orange-600 mt-0.5">{getTotalManpowerToday()}</p>
                                    </div>
                                    <div className="flex space-x-4 text-right text-[11px]">
                                        <div>
                                            <p className="text-gray-400 text-[10px]">To Yesterday</p>
                                            <p className="font-bold text-gray-900 dark:text-white">{cumulativeLastDay.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400 text-[10px]">To Date</p>
                                            <p className="font-bold text-emerald-600 dark:text-emerald-400">{cumulativeUpToDate.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* STEP 3: PROGRESS & PLAN — 2 SEPARATE EDITORS */}
                        {activeStepIndex === 2 && (
                            <section className="space-y-6 anim-fade-in">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                                            Progress & Tomorrow's Plan
                                        </h2>
                                        <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                                            Manage today's site activity progress and tomorrow's plan independently.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-lg text-[10px] font-bold text-gray-600 dark:text-zinc-300 whitespace-nowrap">
                                            <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-zinc-700 rounded text-[9px]">Enter ↵</kbd> Move Field</span>
                                            <span className="text-gray-300 dark:text-zinc-600">|</span>
                                            <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-zinc-700 rounded text-[9px]">⌘/Ctrl+Enter ↵</kbd> New Row</span>
                                        </div>
                                        {projectResources.length > 0 && (
                                            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[10px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                <Sparkles size={11} className="flex-shrink-0" />
                                                <span>{projectResources.length} Items Loaded</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* SECTION 1: TODAY'S PROGRESS */}
                                <div className="space-y-2 bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-zinc-700 rounded-xl p-3 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-700 pb-2">
                                        <div className="flex items-center space-x-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                                1. Today's Progress ({todayRows.length})
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg">
                                        <div className="grid grid-cols-[1fr_90px_60px_30px] gap-0 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-2 py-1 rounded-t-lg">
                                            <span className="text-[9px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Activity / Description</span>
                                            <span className="text-[9px] font-bold text-gray-500 dark:text-zinc-400 uppercase text-center">Unit</span>
                                            <span className="text-[9px] font-bold text-gray-500 dark:text-zinc-400 uppercase text-center">Qty</span>
                                            <span></span>
                                        </div>

                                        {todayRows.map((row, rIdx) => (
                                            <div
                                                key={rIdx}
                                                className="grid grid-cols-[1fr_90px_60px_30px] gap-0 border-b border-gray-200 dark:border-zinc-700 last:border-none bg-white dark:bg-[#161b22] hover:bg-gray-50/40 dark:hover:bg-zinc-800/40 transition-colors last:rounded-b-lg"
                                            >
                                                <div className="p-1.5 space-y-1 border-r border-gray-200 dark:border-zinc-700">
                                                    <MaterialTypeahead
                                                        id={`today-item-${rIdx}`}
                                                        value={row.item}
                                                        onChange={(val) => updateTodayRow(rIdx, 'item', val)}
                                                        onSelectResource={(res) => {
                                                            if (res) {
                                                                updateTodayRow(rIdx, 'item', res.name);
                                                                updateTodayRow(rIdx, 'unit', res.base_unit_code || res.unit || '');
                                                            } else {
                                                                updateTodayRow(rIdx, 'unit', '');
                                                            }
                                                        }}
                                                        resources={projectResources}
                                                        disabled={isReadOnly}
                                                        placeholder="Type to search project item..."
                                                        onEnterNext={() => handleStep3FieldKeyDown({ key: 'Enter', preventDefault: () => {}, stopPropagation: () => {} }, 'today', rIdx, 'item')}
                                                        onKeyDownExtra={(e) => handleStep3FieldKeyDown(e, 'today', rIdx, 'item')}
                                                    />
                                                    <input
                                                        id={`today-desc-${rIdx}`}
                                                        type="text"
                                                        value={row.description}
                                                        onChange={(e) => updateTodayRow(rIdx, 'description', e.target.value)}
                                                        onKeyDown={(e) => handleStep3FieldKeyDown(e, 'today', rIdx, 'description')}
                                                        disabled={isReadOnly}
                                                        autoComplete="off"
                                                        placeholder="Description / area / usage notes"
                                                        className="w-full bg-transparent outline-none text-[10px] text-gray-500 dark:text-zinc-400 placeholder:text-gray-300 dark:placeholder:text-zinc-700"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-center border-r border-gray-200 dark:border-zinc-700 p-1">
                                                    <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                                                        {row.unit || '—'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-center border-r border-gray-200 dark:border-zinc-700 p-1">
                                                    <input
                                                        id={`today-qty-${rIdx}`}
                                                        type="number"
                                                        value={row.qty}
                                                        onChange={(e) => updateTodayRow(rIdx, 'qty', e.target.value)}
                                                        onKeyDown={(e) => handleStep3FieldKeyDown(e, 'today', rIdx, 'qty')}
                                                        disabled={isReadOnly}
                                                        autoComplete="off"
                                                        placeholder="—"
                                                        className="w-full bg-transparent text-center outline-none text-xs font-black text-blue-600 dark:text-blue-400 placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-center p-1">
                                                    {!isReadOnly && todayRows.length > 1 && (
                                                        <button
                                                            onClick={() => deleteTodayRow(rIdx)}
                                                            className="text-gray-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {!isReadOnly && (
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={addTodayRow}
                                            className="w-full py-1.5 border border-dashed border-gray-300 dark:border-zinc-700 hover:border-blue-500 text-gray-500 dark:text-zinc-400 hover:text-blue-500 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 transition-all"
                                        >
                                            <Plus size={12} />
                                            <span>Add Today Activity (⌘/Ctrl+Enter)</span>
                                        </button>
                                    )}
                                </div>

                                {/* SECTION 2: TOMORROW'S PLANNING */}
                                <div className="space-y-2 bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-zinc-700 rounded-xl p-3 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-700 pb-2">
                                        <div className="flex items-center space-x-2">
                                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                                2. Tomorrow's Planning ({tomorrowRows.length})
                                            </h3>
                                        </div>
                                        {!isReadOnly && (
                                            <button
                                                type="button"
                                                onClick={copyTodayToTomorrow}
                                                className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded text-[10px] font-bold flex items-center space-x-1 transition-all"
                                            >
                                                <Copy size={10} />
                                                <span>Copy Today's Items</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg">
                                        <div className="grid grid-cols-[1fr_90px_60px_30px] gap-0 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-2 py-1 rounded-t-lg">
                                            <span className="text-[9px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Activity / Description</span>
                                            <span className="text-[9px] font-bold text-gray-500 dark:text-zinc-400 uppercase text-center">Unit</span>
                                            <span className="text-[9px] font-bold text-gray-500 dark:text-zinc-400 uppercase text-center">Qty</span>
                                            <span></span>
                                        </div>

                                        {tomorrowRows.map((row, rIdx) => (
                                            <div
                                                key={rIdx}
                                                className="grid grid-cols-[1fr_90px_60px_30px] gap-0 border-b border-gray-200 dark:border-zinc-700 last:border-none bg-white dark:bg-[#161b22] hover:bg-gray-50/40 dark:hover:bg-zinc-800/40 transition-colors"
                                            >
                                                <div className="p-1.5 space-y-1 border-r border-gray-200 dark:border-zinc-700">
                                                    <MaterialTypeahead
                                                        id={`tomorrow-item-${rIdx}`}
                                                        value={row.item}
                                                        onChange={(val) => updateTomorrowRow(rIdx, 'item', val)}
                                                        onSelectResource={(res) => {
                                                            if (res) {
                                                                updateTomorrowRow(rIdx, 'item', res.name);
                                                                updateTomorrowRow(rIdx, 'unit', res.base_unit_code || res.unit || '');
                                                            } else {
                                                                updateTomorrowRow(rIdx, 'unit', '');
                                                            }
                                                        }}
                                                        resources={projectResources}
                                                        disabled={isReadOnly}
                                                        placeholder="Type to search project item..."
                                                        onEnterNext={() => handleStep3FieldKeyDown({ key: 'Enter', preventDefault: () => {}, stopPropagation: () => {} }, 'tomorrow', rIdx, 'item')}
                                                        onKeyDownExtra={(e) => handleStep3FieldKeyDown(e, 'tomorrow', rIdx, 'item')}
                                                    />
                                                    <input
                                                        id={`tomorrow-desc-${rIdx}`}
                                                        type="text"
                                                        value={row.description}
                                                        onChange={(e) => updateTomorrowRow(rIdx, 'description', e.target.value)}
                                                        onKeyDown={(e) => handleStep3FieldKeyDown(e, 'tomorrow', rIdx, 'description')}
                                                        disabled={isReadOnly}
                                                        autoComplete="off"
                                                        placeholder="Description / area / usage notes"
                                                        className="w-full bg-transparent outline-none text-[10px] text-gray-500 dark:text-zinc-400 placeholder:text-gray-300 dark:placeholder:text-zinc-700"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-center border-r border-gray-200 dark:border-zinc-700 p-1">
                                                    <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                                                        {row.unit || '—'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-center border-r border-gray-200 dark:border-zinc-700 p-1">
                                                    <input
                                                        id={`tomorrow-qty-${rIdx}`}
                                                        type="number"
                                                        value={row.qty}
                                                        onChange={(e) => updateTomorrowRow(rIdx, 'qty', e.target.value)}
                                                        onKeyDown={(e) => handleStep3FieldKeyDown(e, 'tomorrow', rIdx, 'qty')}
                                                        disabled={isReadOnly}
                                                        autoComplete="off"
                                                        placeholder="—"
                                                        className="w-full bg-transparent text-center outline-none text-xs font-black text-indigo-600 dark:text-indigo-400 placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-center p-1">
                                                    {!isReadOnly && tomorrowRows.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteTomorrowRow(rIdx)}
                                                            className="text-gray-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {!isReadOnly && (
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={addTomorrowRow}
                                            className="w-full py-1.5 border border-dashed border-gray-300 dark:border-zinc-700 hover:border-indigo-500 text-gray-500 dark:text-zinc-400 hover:text-indigo-500 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 transition-all"
                                        >
                                            <Plus size={12} />
                                            <span>Add Tomorrow Activity</span>
                                        </button>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* STEP 4: EVENTS, REMARKS & REVIEW */}
                        {activeStepIndex === 3 && (
                            <section className="space-y-5 anim-fade-in">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                                        Events, Remarks & Final Review
                                    </h2>
                                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                                        Record site visits, safety remarks, distribution presets, and review final summary.
                                    </p>
                                </div>

                                {/* Events List */}
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300">
                                        Events / Visits Notes
                                    </label>
                                    {eventsList.map((evt, idx) => (
                                        <div key={idx} className="flex items-center space-x-1.5">
                                            <input 
                                                type="text" 
                                                value={evt} 
                                                onChange={(e) => {
                                                    const updated = [...eventsList];
                                                    updated[idx] = e.target.value;
                                                    setEventsList(updated);
                                                }}
                                                placeholder="Details of visits, quality inspections..."
                                                className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-xs"
                                            />
                                            {!isReadOnly && eventsList.length > 1 && (
                                                <button onClick={() => deleteEventRow(idx)} className="text-gray-400 hover:text-red-500 p-0.5">
                                                    <X size={13} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {!isReadOnly && (
                                        <button onClick={addEventRow} className="text-[11px] font-bold text-orange-600 flex items-center space-x-1">
                                            <Plus size={11} /> <span>Add Event</span>
                                        </button>
                                    )}
                                </div>

                                {/* Remarks List */}
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300">
                                        Remarks & Bottlenecks
                                    </label>
                                    {remarksList.map((rem, idx) => (
                                        <div key={idx} className="flex items-center space-x-1.5">
                                            <input 
                                                type="text" 
                                                value={rem} 
                                                onChange={(e) => {
                                                    const updated = [...remarksList];
                                                    updated[idx] = e.target.value;
                                                    setRemarksList(updated);
                                                }}
                                                placeholder="Safety notes, critical milestones..."
                                                className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-xs"
                                            />
                                            {!isReadOnly && remarksList.length > 1 && (
                                                <button onClick={() => deleteRemarkRow(idx)} className="text-gray-400 hover:text-red-500 p-0.5">
                                                    <X size={13} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {!isReadOnly && (
                                        <button onClick={addRemarkRow} className="text-[11px] font-bold text-orange-600 flex items-center space-x-1">
                                            <Plus size={11} /> <span>Add Remark</span>
                                        </button>
                                    )}
                                </div>

                                {/* Distribution & Prepared By — styled pill selectors */}
                                <div className="space-y-3 pt-1">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-2">Distribution</label>
                                        <div className="flex flex-wrap gap-2">
                                            {configuredDistributions.map(d => (
                                                <button
                                                    key={d}
                                                    type="button"
                                                    onClick={() => setDistribution(d)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                                        distribution === d
                                                            ? 'bg-orange-600 border-orange-600 text-white shadow-sm shadow-orange-500/30'
                                                            : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-orange-400'
                                                    }`}
                                                >
                                                    {distribution === d && <Check size={10} className="inline mr-1" />}
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-2">Prepared By</label>
                                        <div className="flex flex-wrap gap-2">
                                            {configuredPreparedBys.map(p => (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setPreparedBy(p)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                                        preparedBy === p
                                                            ? 'bg-gray-800 dark:bg-zinc-200 border-gray-800 dark:border-zinc-200 text-white dark:text-gray-900 shadow-sm'
                                                            : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-gray-600'
                                                    }`}
                                                >
                                                    {preparedBy === p && <Check size={10} className="inline mr-1" />}
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Final Review Cards */}
                                <div className="p-3.5 bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-xl space-y-1.5">
                                    <h3 className="text-xs font-bold text-orange-800 dark:text-orange-300">Ready to generate PDF</h3>
                                    <p className="text-[11px] text-orange-700/80 dark:text-orange-400/80">
                                        Clicking Generate & Save will finalize the report and render the official PDF document.
                                    </p>
                                </div>
                            </section>
                        )}

                    </div>

                    {/* Step Navigation Footer Controls */}
                    <div className="p-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/80 flex items-center justify-between flex-shrink-0">
                        <button
                            onClick={() => setActiveStepIndex(Math.max(0, activeStepIndex - 1))}
                            disabled={activeStepIndex === 0}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeStepIndex === 0 
                                    ? 'opacity-40 cursor-not-allowed text-gray-400' 
                                    : 'hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300'
                            }`}
                        >
                            ← Back
                        </button>

                        {activeStepIndex < steps.length - 1 ? (
                            <button
                                onClick={() => setActiveStepIndex(activeStepIndex + 1)}
                                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 transition-all"
                            >
                                <span>Next</span>
                                <ChevronRight size={13} />
                            </button>
                        ) : (
                            <button
                                onClick={handleFinalize}
                                className="px-5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-md shadow-orange-500/20 flex items-center space-x-1.5 transition-all"
                            >
                                <Send size={13} />
                                <span>Generate & Save PDF</span>
                            </button>
                        )}
                    </div>
                </main>

                {/* SECTION 2: EXPANDED LIVE PDF PREVIEW (PERFECT TABLE ALIGNMENT & REMARKS FIX) */}
                <aside className="bg-white dark:bg-[#161b22] border border-[#E4E0D4] dark:border-zinc-800 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="px-5 py-3.5 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-900/50">
                        <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Live PDF Preview</span>
                        </div>
                        <span className="text-xs text-gray-500 font-mono font-bold">Official Standard Sheet View</span>
                    </div>

                    {/* Official Standard DPR Sheet View Container */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#F6F3EC] dark:bg-[#0b0e14] flex justify-center">
                        
                        <div className="w-full max-w-4xl bg-white dark:bg-[#161b22] border border-gray-400 dark:border-zinc-700 shadow-xl p-6 md:p-8 space-y-0 text-gray-900 dark:text-gray-100 text-[11px] font-sans overflow-x-auto">
                            
                            {/* 1. Header Block Table */}
                            <table className="w-full border-collapse border border-gray-400 dark:border-zinc-700 text-xs">
                                <tbody>
                                    <tr>
                                        <td className="w-1/3 p-3 border border-gray-400 dark:border-zinc-700 text-center font-bold bg-gray-50 dark:bg-[#1f242c]">
                                            {project?.logo_url ? (
                                                <img src={project.logo_url} alt="Client Logo" className="max-h-12 max-w-[140px] mx-auto object-contain" />
                                            ) : (
                                                <span className="text-gray-700 dark:text-zinc-300 text-xs font-bold uppercase tracking-widest">
                                                    CLIENT LOGO
                                                </span>
                                            )}
                                        </td>
                                        <td className="w-1/3 p-3 border border-gray-400 dark:border-zinc-700 text-center font-bold bg-gray-50 dark:bg-[#1f242c]">
                                            <img src="/mano-logo.svg" alt="Mano Logo" className="max-h-12 mx-auto object-contain dark:invert" />
                                        </td>
                                        <td className="w-1/3 border border-gray-400 dark:border-zinc-700 text-center font-bold p-0">
                                            <div className="p-2 border-b border-gray-400 uppercase tracking-widest text-xs font-black bg-gray-100 dark:bg-[#1f242c] text-gray-900 dark:text-gray-100">
                                                DAILY PROGRESS REPORT
                                            </div>
                                            <div className="flex text-xs h-8">
                                                <div className="w-1/2 flex items-center justify-center bg-gray-50 dark:bg-[#1f242c] font-bold border-r border-gray-400 text-gray-700 dark:text-zinc-300">
                                                    REPORT DATE
                                                </div>
                                                <div className="w-1/2 flex items-center justify-center font-black bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100">
                                                    {formatDateToExcel(reportDate)}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* 2. Metadata Grid */}
                            <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[11px]">
                                <tbody>
                                    <tr>
                                        <td rowSpan={5} className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold bg-gray-100 dark:bg-[#1f242c] border-r border-gray-400 [writing-mode:vertical-lr] rotate-180 text-[10px] text-gray-700 dark:text-zinc-300 tracking-wider">
                                            PROJECT
                                        </td>
                                        <td className="w-28 bg-gray-50 dark:bg-[#1f242c] p-1.5 font-bold border-b border-r border-gray-400 text-gray-700 dark:text-zinc-300">Name of Work:</td>
                                        <td colSpan={3} className="p-1.5 border-b border-r border-gray-400 font-bold bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100">{project?.name || '30 Juin Hotel'}</td>
                                        <td colSpan={2} className="bg-gray-50 dark:bg-[#1f242c] p-1.5 font-bold border-b border-r border-gray-400 text-gray-700 dark:text-zinc-300 text-center leading-tight">Project Start Date</td>
                                        <td className="w-24 p-1.5 border-b border-gray-400 font-bold bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 text-center">{formatDateToExcel(metrics.start)}</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-gray-50 dark:bg-[#1f242c] p-1.5 font-bold border-b border-r border-gray-400 text-gray-700 dark:text-zinc-300">Employer:</td>
                                        <td colSpan={3} className="p-1.5 border-b border-r border-gray-400 bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100">{project?.metadata?.employer || 'Glowmex Processing LLP'}</td>
                                        <td colSpan={2} className="bg-gray-50 dark:bg-[#1f242c] p-1.5 font-bold border-b border-r border-gray-400 text-gray-700 dark:text-zinc-300 text-center leading-tight">Project Completion</td>
                                        <td className="p-1.5 border-b border-gray-400 bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 text-center font-bold">{formatDateToExcel(metrics.end)}</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-gray-50 dark:bg-[#1f242c] p-1.5 font-bold border-b border-r border-gray-400 text-gray-700 dark:text-zinc-300">Project Code.:</td>
                                        <td colSpan={6} className="p-1.5 border-b border-gray-400 font-bold bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100">{project?.project_code || '2526-96'}</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-gray-50 dark:bg-[#1f242c] p-1.5 font-bold border-b border-r border-gray-400 text-gray-700 dark:text-zinc-300">Location:</td>
                                        <td colSpan={6} className="p-1.5 border-b border-gray-400 font-bold bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100">{project?.location || project?.metadata?.location || 'Lubumbashi, Congo'}</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-gray-50 dark:bg-[#1f242c] p-1.5 font-bold border-r border-gray-400 text-gray-700 dark:text-zinc-300">Dur. in Days:</td>
                                        <td className="w-14 bg-gray-50 dark:bg-[#1f242c] p-1.5 border-r border-gray-400 text-center font-bold text-gray-700 dark:text-zinc-300">Total</td>
                                        <td className="p-1.5 border-r border-gray-400 text-center font-black bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100">{metrics.total}</td>
                                        <td className="w-14 bg-gray-50 dark:bg-[#1f242c] p-1.5 border-r border-gray-400 text-center font-bold text-gray-700 dark:text-zinc-300">Elapsed</td>
                                        <td className="p-1.5 border-r border-gray-400 text-center font-black bg-white dark:bg-[#161b22] text-blue-600 dark:text-blue-400">{metrics.passed}</td>
                                        <td className="w-16 bg-gray-50 dark:bg-[#1f242c] p-1.5 border-r border-gray-400 text-center font-bold text-gray-700 dark:text-zinc-300">Balance</td>
                                        <td className="p-1.5 text-center font-black bg-white dark:bg-[#161b22] text-emerald-600 dark:text-emerald-400">{metrics.balance}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* 3. Site Environment Table */}
                            <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[11px]">
                                <tbody>
                                    {timeSlots.map((slot, idx) => (
                                        <tr key={idx} className="bg-white dark:bg-[#161b22] border-b border-gray-400">
                                            {idx === 0 && (
                                                <td 
                                                    rowSpan={timeSlots.length} 
                                                    className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold bg-gray-100 dark:bg-[#1f242c] border-r border-gray-400 text-gray-700 dark:text-zinc-300 [writing-mode:vertical-lr] rotate-180 align-middle"
                                                >
                                                    SITE
                                                </td>
                                            )}
                                            {idx === 0 && (
                                                <td rowSpan={timeSlots.length} className="p-2 border-r border-gray-400 w-1/3 align-middle bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 font-bold">
                                                    <div className="flex items-center space-x-3">
                                                        <span>[{weather === 'sunny' ? '✓' : ' '}] Normal Day</span>
                                                        <span>[{weather === 'rainy' ? '✓' : ' '}] Rainy</span>
                                                    </div>
                                                </td>
                                            )}
                                            <td className="p-2 border-r border-gray-400 w-1/3 align-middle bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 font-bold text-center">
                                                <span>From: <b>{slot.from || '—'}</b> To: <b>{slot.to || '—'}</b></span>
                                            </td>
                                            {idx === 0 && (
                                                <td rowSpan={timeSlots.length} className="p-2 border-gray-400 w-1/3 align-middle bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 font-bold">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-500 dark:text-zinc-400">Site Conditions:</span>
                                                        <span>[{siteCondition === 'slushy' ? '✓' : ' '}] Slushy</span>
                                                        <span>[{siteCondition === 'dry' ? '✓' : ' '}] Dry</span>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* 4. Labour Report Table with Perfect Column Width Alignment */}
                            <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[10px] table-fixed">
                                <tbody>
                                    <tr className="bg-gray-100 dark:bg-[#1f242c] font-bold border-b border-gray-400 text-gray-700 dark:text-zinc-300">
                                        <td rowSpan={labourRows.length + 3} className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold border-r border-gray-400 [writing-mode:vertical-lr] rotate-180 tracking-wider">
                                            LABOUR REPORT
                                        </td>
                                        <td className="p-1.5 border-r border-gray-400 font-bold w-[20%] truncate">Agency Name</td>
                                        {LABOUR_LABELS.map(lbl => (
                                            <td key={lbl} className="px-0.5 py-1 border-r border-gray-400 text-center font-bold text-[8.5px] leading-tight truncate uppercase tracking-tighter" title={lbl}>{lbl}</td>
                                        ))}
                                        <td className="px-0.5 py-1 border-r border-gray-400 text-center font-bold w-10 text-[9px] truncate">Total</td>
                                        <td className="p-1.5 font-bold w-[18%] truncate">Remarks</td>
                                    </tr>
                                    {labourRows.map((row, idx) => (
                                        <tr key={idx} className="border-b border-gray-300 dark:border-zinc-700 bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 font-medium">
                                            <td className="p-1.5 border-r border-gray-400 font-bold truncate">{row.agency || '—'}</td>
                                            {LABOUR_KEYS.map(key => (
                                                <td key={key} className="p-1 border-r border-gray-400 text-center">{row[key] || 0}</td>
                                            ))}
                                            <td className="p-1 border-r border-gray-400 text-center font-bold text-orange-600 dark:text-orange-400">{getRowTotal(row)}</td>
                                            <td className="p-1.5 text-gray-600 dark:text-gray-300 truncate">{row.remarks || '—'}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-100 dark:bg-[#1f242c] font-bold text-gray-900 dark:text-gray-100 border-t-2 border-b border-gray-400">
                                        <td className="p-1.5 border-r border-gray-400 font-bold">Total</td>
                                        {LABOUR_KEYS.map(key => (
                                            <td key={key} className="p-1 border-r border-gray-400 text-center font-extrabold">
                                                {getColTotal(key) || ''}
                                            </td>
                                        ))}
                                        <td className="p-1 border-r border-gray-400 text-center text-orange-600 dark:text-orange-400 font-black text-xs">
                                            {getTotalManpowerToday()}
                                        </td>
                                        <td className="p-1.5"></td>
                                    </tr>
                                    <tr className="bg-gray-50 dark:bg-[#1f242c] font-bold text-gray-900 dark:text-gray-100">
                                        <td colSpan={3} className="p-1 border-r border-gray-400 text-left font-bold text-[8.5px] uppercase">Cumulative Manpower up to last day</td>
                                        <td colSpan={2} className="p-1 border-r border-gray-400 text-center font-bold">{cumulativeLastDay.toLocaleString()}</td>
                                        <td colSpan={6} className="p-1 border-r border-gray-400 text-left font-bold text-[8.5px] uppercase">Cummulative manpower up to date</td>
                                        <td colSpan={2} className="p-1 text-center text-emerald-600 dark:text-emerald-400 font-black">{cumulativeUpToDate.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* 5. Progress / Programme Table */}
                            <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[10px]">
                                <tbody>
                                    <tr className="bg-gray-100 dark:bg-[#1f242c] font-bold border-b border-gray-400 text-gray-700 dark:text-zinc-300">
                                        <td rowSpan={Math.max(todayRows.length, tomorrowRows.length, 1) + 2} className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold border-r border-gray-400 [writing-mode:vertical-lr] rotate-180 tracking-wider">
                                            PROGRESS / PROGRAMME
                                        </td>
                                        <td colSpan={4} className="p-1.5 border-r border-gray-400 text-center uppercase tracking-widest font-bold">Today's Progress</td>
                                        <td colSpan={4} className="p-1.5 text-center uppercase tracking-widest font-bold">Tomorrow's Planning</td>
                                    </tr>
                                    <tr className="bg-gray-100 dark:bg-[#1f242c] font-bold border-b border-gray-400 text-gray-700 dark:text-zinc-300">
                                        <td className="p-1.5 border-r border-gray-400 font-bold w-[20%]">Activity / Item</td>
                                        <td className="p-1.5 border-r border-gray-400 font-bold w-[20%]">Description</td>
                                        <td className="p-1.5 border-r border-gray-400 text-center font-bold w-10">Unit</td>
                                        <td className="p-1.5 border-r border-gray-400 text-center font-bold w-10">Qty</td>
                                        <td className="p-1.5 border-r border-gray-400 font-bold w-[20%]">Activity / Item</td>
                                        <td className="p-1.5 border-r border-gray-400 font-bold w-[20%]">Description</td>
                                        <td className="p-1.5 border-r border-gray-400 text-center font-bold w-10">Unit</td>
                                        <td className="p-1.5 text-center font-bold w-10">Qty</td>
                                    </tr>
                                    {Array.from({ length: Math.max(todayRows.length, tomorrowRows.length, 1) }).map((_, idx) => {
                                        const today = todayRows[idx];
                                        const tomorrow = tomorrowRows[idx];
                                        return (
                                            <tr key={idx} className="border-b border-gray-300 dark:border-zinc-700 bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100">
                                                <td className="p-1.5 border-r border-gray-400 font-bold">{today?.item || ''}</td>
                                                <td className="p-1.5 border-r border-gray-400 text-gray-600 dark:text-gray-300">{today?.description || ''}</td>
                                                <td className="p-1.5 border-r border-gray-400 text-center font-semibold">{today?.unit || ''}</td>
                                                <td className="p-1.5 border-r border-gray-400 text-center font-bold text-blue-600 dark:text-blue-400">{today?.qty || ''}</td>
                                                <td className="p-1.5 border-r border-gray-400 font-bold">{tomorrow?.item || ''}</td>
                                                <td className="p-1.5 border-r border-gray-400 text-gray-600 dark:text-gray-300">{tomorrow?.description || ''}</td>
                                                <td className="p-1.5 border-r border-gray-400 text-center font-semibold">{tomorrow?.unit || ''}</td>
                                                <td className="p-1.5 text-center font-bold text-indigo-600 dark:text-indigo-400">{tomorrow?.qty || ''}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* 6. Events / Visits Table */}
                            <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[10px]">
                                <tbody>
                                    {eventsList.map((evt, idx) => (
                                        <tr key={idx} className="border-b border-dotted border-gray-400 dark:border-zinc-700 bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100">
                                            {idx === 0 && (
                                                <td 
                                                    rowSpan={eventsList.length} 
                                                    className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold bg-gray-100 dark:bg-[#1f242c] border-r border-gray-400 text-gray-700 dark:text-zinc-300 [writing-mode:vertical-lr] rotate-180 align-middle"
                                                >
                                                    EVENTS / VISITS
                                                </td>
                                            )}
                                            <td className="p-1.5 text-left font-medium">
                                                {evt || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* 7. Remarks & Side-by-Side Sign-offs Table */}
                            <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[10px]">
                                <tbody>
                                    {remarksList.map((rem, idx) => (
                                        <tr key={idx} className="border-b border-dotted border-gray-400 dark:border-zinc-700 bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100">
                                            {idx === 0 && (
                                                <td 
                                                    rowSpan={remarksList.length} 
                                                    className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold bg-gray-100 dark:bg-[#1f242c] border-r border-gray-400 text-gray-700 dark:text-zinc-300 [writing-mode:vertical-lr] rotate-180 align-middle"
                                                >
                                                    REMARKS
                                                </td>
                                            )}
                                            <td className="p-1.5 text-left font-medium">
                                                {rem || '—'}
                                            </td>
                                            {idx === 0 && (
                                                <>
                                                    <td rowSpan={remarksList.length} className="w-32 border-l border-r border-gray-400 p-2 align-top bg-white dark:bg-[#161b22]">
                                                        <div className="flex flex-col justify-between h-full space-y-2">
                                                            <span className="font-serif text-[10px] text-gray-600 dark:text-zinc-400">Distribution:</span>
                                                            <div className="flex items-center space-x-1.5">
                                                                <div className="w-3.5 h-3.5 bg-[#7a8b9e] border border-gray-600 flex-shrink-0"></div>
                                                                <span className="font-serif text-xs font-bold text-gray-900 dark:text-gray-100">{distribution}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td rowSpan={remarksList.length} className="w-32 border-r border-gray-400 p-2 align-top bg-white dark:bg-[#161b22]">
                                                        <div className="flex flex-col justify-between h-full space-y-2">
                                                            <span className="font-serif text-[10px] text-gray-600 dark:text-zinc-400">Prepared by:</span>
                                                            <div className="flex items-center space-x-1.5">
                                                                <span className="font-serif text-xs font-bold text-gray-900 dark:text-gray-100">{preparedBy}</span>
                                                                <div className="w-3.5 h-3.5 bg-[#7a8b9e] border border-gray-600 flex-shrink-0"></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td rowSpan={remarksList.length} className="w-24 border-r border-gray-400 p-2 align-top bg-white dark:bg-[#161b22] text-center">
                                                        <span className="font-serif text-xs font-bold text-gray-800 dark:text-gray-200 tracking-wider">MANO</span>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                        </div>

                    </div>
                </aside>

            </div>

        </div>
    );
};

export default DPRCreate;
