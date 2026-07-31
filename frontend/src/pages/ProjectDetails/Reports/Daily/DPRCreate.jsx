import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Send, Plus, X, Download } from 'lucide-react';
import { generalDocsApi } from '../../../../services/generalDocsApi';
import { customToast } from '../../../../utils/toast';

const DEFAULT_TRADES = [
    { key: 'plumber', label: 'Plum ber' },
    { key: 'super', label: 'Super' },
    { key: 'carp', label: 'Carp' },
    { key: 'fitter', label: 'Fitter' },
    { key: 'elect', label: 'Elect' },
    { key: 'opera', label: 'Opera' },
    { key: 'mason', label: 'Mason' },
    { key: 'labou', label: 'Labou' },
    { key: 'storel', label: 'Storel' },
    { key: 'staff', label: 'Staff' }
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

    // Fetch Project Vendors for Vendor Selection
    const [projectVendors, setProjectVendors] = useState([]);

    useEffect(() => {
        const pId = project?.id || project?.dbId;
        if (!pId) return;
        const fetchVendors = async () => {
            try {
                const res = await generalDocsApi.getVendors(pId);
                if (res && res.vendors) {
                    setProjectVendors(res.vendors);
                }
            } catch (err) {
                console.error('Failed to fetch project vendors:', err);
            }
        };
        fetchVendors();
    }, [project]);

    // 2. Weather & Dynamic Time Slots State (Single default timer)
    const [weather, setWeather] = useState(initialData?.weather === 'rainy' ? 'rainy' : 'sunny');
    const [siteCondition, setSiteCondition] = useState(initialData?.siteCondition || 'dry');
    
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

    // 3. Labour Grid State & Selection Navigation
    const defaultLabour = [
        { agency: 'MANO PMC', plumber: 0, super: 0, carp: 0, fitter: 0, elect: 0, opera: 0, mason: 0, labou: 0, storel: 0, staff: 3, remarks: '' },
        { agency: 'Departmental (Ind)', plumber: 1, super: 2, carp: 3, fitter: 3, elect: 1, opera: 0, mason: 0, labou: 0, storel: 1, staff: 0, remarks: '' },
        { agency: 'Departmental (Con)', plumber: 0, super: 1, carp: 4, fitter: 4, elect: 3, opera: 1, mason: 1, labou: 37, storel: 2, staff: 0, remarks: '' },
    ];

    const [labourRows, setLabourRows] = useState(() => {
        const mapped = mapInitialLabourData(initialData?.labourData);
        if (mapped) return mapped;

        // Construct rows with dynamic configured trades
        return defaultLabour.map(r => {
            const row = { agency: r.agency, remarks: r.remarks };
            LABOUR_KEYS.forEach(k => {
                row[k] = r[k] !== undefined ? r[k] : 0;
            });
            return row;
        });
    });

    const [selectedCell, setSelectedCell] = useState(null); // { row: number, col: number }
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

    const handleCellClick = (rIdx, cIdx) => {
        if (isReadOnly) return;
        setSelectedProgressCell(null);
        setIsEditingProgressCell(false);
        if (selectedCell?.row === rIdx && selectedCell?.col === cIdx) {
            setIsEditingCell(true);
            return;
        }
        setSelectedCell({ row: rIdx, col: cIdx });
        setIsEditingCell(false);
    };

    const handleCellDoubleClick = (rIdx, cIdx) => {
        if (isReadOnly) return;
        setSelectedProgressCell(null);
        setIsEditingProgressCell(false);
        setSelectedCell({ row: rIdx, col: cIdx });
        setIsEditingCell(true);
    };

    // Keyboard Navigation & Shortcuts for Labour Grid
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selectedCell || isReadOnly) return;

            const { row, col } = selectedCell;
            const currentKey = LABOUR_KEYS[col];

            if (isEditingCell) {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditingCell(false);
                }
                return;
            }

            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
                return;
            }

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    if (row > 0) setSelectedCell({ row: row - 1, col });
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (row < labourRows.length - 1) setSelectedCell({ row: row + 1, col });
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (col > 0) setSelectedCell({ row, col: col - 1 });
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (col < LABOUR_KEYS.length - 1) setSelectedCell({ row, col: col + 1 });
                    break;
                case 'Enter':
                    e.preventDefault();
                    setIsEditingCell(true);
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    updateLabourRow(row, currentKey, (parseInt(labourRows[row][currentKey]) || 0) + 1);
                    break;
                case '-':
                case '_':
                    e.preventDefault();
                    updateLabourRow(row, currentKey, Math.max(0, (parseInt(labourRows[row][currentKey]) || 0) - 1));
                    break;
                case 'Backspace':
                case 'Delete':
                    e.preventDefault();
                    updateLabourRow(row, currentKey, 0);
                    break;
                default:
                    if (/^[0-9]$/.test(e.key)) {
                        e.preventDefault();
                        updateLabourRow(row, currentKey, parseInt(e.key, 10));
                        setIsEditingCell(true);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedCell, isEditingCell, labourRows, isReadOnly]);

    const addLabourRow = () => {
        if (projectVendors.length === 0) {
            customToast.warning('No vendors in project vendor list. Please add vendors in Project Settings / Vendors first.', 'No Vendors Found');
        }
        const newRow = { agency: '', remarks: '' };
        LABOUR_KEYS.forEach(k => { newRow[k] = 0; });
        setLabourRows([...labourRows, newRow]);
    };

    const deleteLabourRow = (idx) => {
        setLabourRows(labourRows.filter((_, i) => i !== idx));
    };

    // 4. Progress / Programme Grid State & Shortcuts
    const defaultProgressRows = [
        { todayItem: 'RCC M-30', todayDesc: 'Column C22 & C14 (2nd lift)', todayUnit: 'Cum', todayQty: '15', tomorrowItem: 'RCC M-30', tomorrowDesc: 'Column C22 & C14 (2nd lift)', tomorrowUnit: 'Cum', tomorrowQty: '15' },
        { todayItem: 'Shuttering Work', todayDesc: 'Column C35, C36 & C41', todayUnit: 'Sqm', todayQty: '10', tomorrowItem: 'Shuttering Work', tomorrowDesc: 'Column C35, C36 & C41', tomorrowUnit: 'Sqm', tomorrowQty: '10' },
        { todayItem: 'Shuttering Work', todayDesc: 'Staircase bottom', todayUnit: 'Sqm', todayQty: '10', tomorrowItem: 'Shuttering Work', tomorrowDesc: 'Staircase bottom', tomorrowUnit: 'Sqm', tomorrowQty: '10' },
        { todayItem: 'Reinf. Steel Work', todayDesc: 'Fire Tank', todayUnit: 'MT', todayQty: '2', tomorrowItem: 'Reinf. Steel Work', tomorrowDesc: 'Fire Tank', tomorrowUnit: 'MT', tomorrowQty: '2' },
        { todayItem: 'Reinf. Steel Work', todayDesc: 'Service Lift', todayUnit: 'MT', todayQty: '1', tomorrowItem: 'Reinf. Steel Work', tomorrowDesc: 'Service Lift', tomorrowUnit: 'MT', tomorrowQty: '1' },
        { todayItem: 'Shuttering Work', todayDesc: 'Ground Floor slab-beam bottom', todayUnit: 'Sqm', todayQty: '3', tomorrowItem: 'Shuttering Work', tomorrowDesc: 'Ground Floor slab-beam bottom', tomorrowUnit: 'Sqm', tomorrowQty: '3' }
    ];

    const [progressRows, setProgressRows] = useState(() => {
        const mapped = mapInitialProgressData(initialData);
        return mapped || defaultProgressRows;
    });

    const [selectedProgressCell, setSelectedProgressCell] = useState(null); // { row: number, col: number }
    const [isEditingProgressCell, setIsEditingProgressCell] = useState(false);

    const updateProgressRowField = (rIdx, key, val) => {
        const updated = [...progressRows];
        updated[rIdx][key] = val;
        setProgressRows(updated);
    };

    const addProgressRow = () => {
        setProgressRows([
            ...progressRows,
            { todayItem: '', todayDesc: '', todayUnit: '', todayQty: '', tomorrowItem: '', tomorrowDesc: '', tomorrowUnit: '', tomorrowQty: '' }
        ]);
    };

    const deleteProgressRow = (rIdx) => {
        if (progressRows.length <= 1) return;
        setProgressRows(progressRows.filter((_, i) => i !== rIdx));
    };

    const handleProgressCellClick = (rIdx, cIdx) => {
        if (isReadOnly) return;
        setSelectedCell(null);
        setIsEditingCell(false);
        if (selectedProgressCell?.row === rIdx && selectedProgressCell?.col === cIdx) {
            setIsEditingProgressCell(true);
            return;
        }
        setSelectedProgressCell({ row: rIdx, col: cIdx });
        setIsEditingProgressCell(false);
    };

    const handleProgressCellDoubleClick = (rIdx, cIdx) => {
        if (isReadOnly) return;
        setSelectedCell(null);
        setIsEditingCell(false);
        setSelectedProgressCell({ row: rIdx, col: cIdx });
        setIsEditingProgressCell(true);
    };

    // Keyboard Shortcuts for Progress Grid
    useEffect(() => {
        const handleProgressKeyDown = (e) => {
            if (!selectedProgressCell || isReadOnly) return;

            const { row, col } = selectedProgressCell;
            const currentKey = PROGRESS_KEYS[col];

            if (isEditingProgressCell) {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditingProgressCell(false);
                }
                return;
            }

            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
                return;
            }

            const isQtyCol = currentKey === 'todayQty' || currentKey === 'tomorrowQty';

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    if (row > 0) setSelectedProgressCell({ row: row - 1, col });
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (row < progressRows.length - 1) setSelectedProgressCell({ row: row + 1, col });
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (col > 0) setSelectedProgressCell({ row, col: col - 1 });
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (col < PROGRESS_KEYS.length - 1) setSelectedProgressCell({ row, col: col + 1 });
                    break;
                case 'Enter':
                    e.preventDefault();
                    setIsEditingProgressCell(true);
                    break;
                case '+':
                case '=':
                    if (isQtyCol) {
                        e.preventDefault();
                        const currentVal = parseInt(progressRows[row][currentKey], 10) || 0;
                        updateProgressRowField(row, currentKey, String(currentVal + 1));
                    }
                    break;
                case '-':
                case '_':
                    if (isQtyCol) {
                        e.preventDefault();
                        const currentVal = parseInt(progressRows[row][currentKey], 10) || 0;
                        updateProgressRowField(row, currentKey, String(Math.max(0, currentVal - 1)));
                    }
                    break;
                case 'Backspace':
                case 'Delete':
                    e.preventDefault();
                    updateProgressRowField(row, currentKey, '');
                    break;
                default:
                    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                        updateProgressRowField(row, currentKey, e.key);
                        setIsEditingProgressCell(true);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleProgressKeyDown);
        return () => window.removeEventListener('keydown', handleProgressKeyDown);
    }, [selectedProgressCell, isEditingProgressCell, progressRows, isReadOnly]);

    // 5. Dynamic Events & Remarks State (Default 3 events & 3 remarks rows)
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

    const handleFinalize = () => {
        const totalWorkers = getTotalManpowerToday();
        const activeTodayTasks = progressRows.filter(r => r.todayItem).map(r => r.todayItem).join(', ');
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
            todayProgress: progressRows.map(r => ({ item: r.todayItem, description: r.todayDesc, unit: r.todayUnit, qty: r.todayQty })).filter(r => r.item || r.description),
            tomorrowPlan: progressRows.map(r => ({ item: r.tomorrowItem, description: r.tomorrowDesc, unit: r.tomorrowUnit, qty: r.tomorrowQty })).filter(r => r.item || r.description),
            progressRows,
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
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0d1117] text-gray-700 dark:text-gray-300 w-full font-sans select-text">
            {/* Header Control Bar */}
            <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-md border-b border-gray-200 dark:border-white/5 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <button 
                        onClick={onBack}
                        className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
                            {isReadOnly ? 'Daily Progress Report View' : 'New Daily Progress Report'}
                        </h2>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                            {project?.name || 'Mano ERP'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {isReadOnly ? (
                        <>
                            <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all">
                                <Download size={14} />
                                <span>Export PDF</span>
                            </button>
                            <button onClick={onBack} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all">
                                <span>Close</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={onBack}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all border border-gray-200 dark:border-transparent"
                            >
                                <span>Cancel</span>
                            </button>
                            <button 
                                onClick={handleFinalize}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-blue-500/20 active:scale-95"
                            >
                                <Send size={14} />
                                <span>Generate & Save</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Excel Sheet Area */}
            <div className="flex-1 overflow-auto p-6 md:p-12 flex justify-center bg-gray-100 dark:bg-[#0b0e14] custom-scrollbar">
                <div className="w-full max-w-5xl bg-white dark:bg-[#161b22] border border-gray-300 dark:border-zinc-700 shadow-xl p-6 md:p-10 flex flex-col space-y-0 text-gray-800 dark:text-zinc-150">
                    
                    {/* 1. Header Block Table */}
                    <table className="w-full border-collapse border border-gray-400 dark:border-zinc-700 text-xs">
                        <tbody>
                            <tr>
                                {/* Client Logo */}
                                <td className="w-1/3 p-4 border border-gray-400 dark:border-zinc-700 text-center font-bold bg-gray-100/60 dark:bg-[#1f242c] align-middle">
                                    {project?.logo_url ? (
                                        <img src={project.logo_url} alt="Client Logo" className="max-h-12 max-w-[150px] mx-auto object-contain" />
                                    ) : (
                                        <span className="text-gray-400 dark:text-zinc-400 uppercase tracking-widest text-[9px] font-bold">
                                            {project?.metadata?.client || 'CLIENT LOGO'}
                                        </span>
                                    )}
                                </td>
                                
                                {/* Mano Logo */}
                                <td className="w-1/3 p-4 border border-gray-400 dark:border-zinc-700 text-center font-bold bg-gray-100/60 dark:bg-[#1f242c] align-middle">
                                    <img src="/mano-logo.svg" alt="Mano Logo" className="max-h-12 mx-auto object-contain dark:invert" />
                                </td>
                                
                                {/* Report Date Section */}
                                <td className="w-1/3 border border-gray-400 dark:border-zinc-700 text-center font-bold p-0 align-middle">
                                    <div className="p-2 border-b border-gray-400 dark:border-zinc-700 uppercase tracking-widest font-extrabold text-xs text-gray-900 dark:text-white bg-gray-100/60 dark:bg-[#1f242c]">
                                        DAILY PROGRESS REPORT
                                    </div>
                                    <div className="flex text-[10px] h-9">
                                        <div className="w-1/2 flex items-center justify-center bg-gray-100/90 dark:bg-[#1f242c] font-bold border-r border-gray-400 dark:border-zinc-700 select-none text-gray-700 dark:text-zinc-300">
                                            REPORT DATE
                                        </div>
                                        <div className="w-1/2 p-1 flex items-center justify-center bg-white dark:bg-[#161b22]">
                                            <span className="font-extrabold text-gray-900 dark:text-white tracking-wide">
                                                {formatDateToExcel(reportDate)}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* 2. Project Metadata Table - 7 Columns Grid */}
                    <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[11px]">
                        <tbody>
                            <tr>
                                {/* Fixed width vertical header matching exactly across all section tables */}
                                <td 
                                    rowSpan={5} 
                                    style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
                                    className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold bg-gray-100/90 dark:bg-[#1f242c] border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 [writing-mode:vertical-lr] rotate-180 select-none align-middle"
                                >
                                    PROJECT
                                </td>
                                <td className="w-28 bg-gray-100/90 dark:bg-[#1f242c] p-2 font-bold border-b border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 select-none">
                                    Name of Work:
                                </td>
                                <td colSpan={2} className="p-2 border-b border-r border-gray-400 dark:border-zinc-700 text-left font-semibold text-gray-900 dark:text-white bg-white dark:bg-[#161b22]">
                                    {project?.name || '—'}
                                </td>
                                <td colSpan={2} className="w-36 bg-gray-100/90 dark:bg-[#1f242c] p-2 font-bold border-b border-r border-gray-400 dark:border-zinc-700 text-center text-gray-700 dark:text-zinc-300 select-none">
                                    Project Start Date
                                </td>
                                <td colSpan={2} className="w-32 p-2 border-b border-gray-400 dark:border-zinc-700 text-center font-semibold text-gray-900 dark:text-white bg-white dark:bg-[#161b22]">
                                    {formatDateToExcel(metrics.start)}
                                </td>
                            </tr>
                            <tr>
                                <td className="bg-gray-100/90 dark:bg-[#1f242c] p-2 font-bold border-b border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 select-none">
                                    Employer:
                                </td>
                                <td colSpan={2} className="p-2 border-b border-r border-gray-400 dark:border-zinc-700 text-left font-semibold text-gray-900 dark:text-white bg-white dark:bg-[#161b22]">
                                    {project?.metadata?.employer || '—'}
                                </td>
                                <td colSpan={2} className="bg-gray-100/90 dark:bg-[#1f242c] p-2 font-bold border-b border-r border-gray-400 dark:border-zinc-700 text-center text-gray-700 dark:text-zinc-300 select-none">
                                    Project Completion
                                </td>
                                <td colSpan={2} className="p-2 border-b border-gray-400 dark:border-zinc-700 text-center font-semibold text-gray-900 dark:text-white bg-white dark:bg-[#161b22]">
                                    {formatDateToExcel(metrics.end)}
                                </td>
                            </tr>
                            <tr>
                                <td className="bg-gray-100/90 dark:bg-[#1f242c] p-2 font-bold border-b border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 select-none">
                                    Project Code:
                                </td>
                                <td colSpan={6} className="p-2 border-b border-gray-400 dark:border-zinc-700 text-left font-semibold text-gray-900 dark:text-white bg-white dark:bg-[#161b22]">
                                    {project?.project_code || '—'}
                                </td>
                            </tr>
                            <tr>
                                <td className="bg-gray-100/90 dark:bg-[#1f242c] p-2 font-bold border-b border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 select-none">
                                    Location:
                                </td>
                                <td colSpan={6} className="p-2 border-b border-gray-400 dark:border-zinc-700 text-left font-semibold text-gray-900 dark:text-white bg-white dark:bg-[#161b22]">
                                    {project?.location || '—'}
                                </td>
                            </tr>
                            {/* Dur in Days - Standard 7-Cell Row for Perfect Height & Width Alignment */}
                            <tr>
                                <td className="bg-gray-100/90 dark:bg-[#1f242c] p-2 font-bold border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 select-none">
                                    Dur. in Days:
                                </td>
                                <td className="bg-gray-100/90 dark:bg-[#1f242c] p-2 font-bold border-r border-gray-400 dark:border-zinc-700 text-center text-gray-700 dark:text-zinc-300 select-none w-20">
                                    Total
                                </td>
                                <td className="p-2 border-r border-gray-400 dark:border-zinc-700 text-center font-extrabold text-gray-900 dark:text-white bg-white dark:bg-[#161b22]">
                                    {metrics.total}
                                </td>
                                <td className="bg-gray-100/90 dark:bg-[#1f242c] p-2 font-bold border-r border-gray-400 dark:border-zinc-700 text-center text-gray-700 dark:text-zinc-300 select-none w-20">
                                    Elapsed
                                </td>
                                <td className="p-2 border-r border-gray-400 dark:border-zinc-700 text-center font-extrabold text-blue-600 dark:text-blue-400 bg-white dark:bg-[#161b22]">
                                    {metrics.passed}
                                </td>
                                <td className="bg-gray-100/90 dark:bg-[#1f242c] p-2 font-bold border-r border-gray-400 dark:border-zinc-700 text-center text-gray-700 dark:text-zinc-300 select-none w-20">
                                    Balance
                                </td>
                                <td className="p-2 border-gray-400 dark:border-zinc-700 text-center font-extrabold text-red-600 dark:text-red-400 bg-white dark:bg-[#161b22]">
                                    {metrics.balance}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* 3. Site Environment Table with Dynamic Time Slots (Single Default Timer) */}
                    <div className="relative">
                        <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[11px]">
                            <tbody>
                                {timeSlots.map((slot, idx) => (
                                    <tr key={idx} className="bg-white dark:bg-[#161b22] border-b border-gray-400 dark:border-zinc-700">
                                        {/* Fixed width vertical header matching exactly across all section tables */}
                                        {idx === 0 && (
                                            <td 
                                                rowSpan={timeSlots.length} 
                                                style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
                                                className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold bg-gray-100/90 dark:bg-[#1f242c] border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 [writing-mode:vertical-lr] rotate-180 select-none align-middle"
                                            >
                                                SITE
                                            </td>
                                        )}
                                        
                                        {/* Normal / Rainy Checkboxes - RowSpan = timeSlots.length */}
                                        {idx === 0 && (
                                            <td rowSpan={timeSlots.length} className="p-2 border-r border-gray-400 dark:border-zinc-700 w-1/3 align-middle bg-white dark:bg-[#161b22]">
                                                <div className="flex justify-around items-center h-full">
                                                    <label className="flex items-center space-x-2 cursor-pointer font-bold text-gray-800 dark:text-zinc-200">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={weather === 'sunny'} 
                                                            disabled={isReadOnly}
                                                            onChange={() => setWeather('sunny')}
                                                            className="w-3.5 h-3.5 text-blue-600 border-gray-300 dark:border-zinc-600 rounded focus:ring-blue-500 bg-transparent" 
                                                        />
                                                        <span>Normal Day</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 cursor-pointer font-bold text-gray-800 dark:text-zinc-200">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={weather === 'rainy'} 
                                                            disabled={isReadOnly}
                                                            onChange={() => setWeather('rainy')}
                                                            className="w-3.5 h-3.5 text-blue-600 border-gray-300 dark:border-zinc-600 rounded focus:ring-blue-500 bg-transparent" 
                                                        />
                                                        <span>Rainy</span>
                                                    </label>
                                                </div>
                                            </td>
                                        )}
                                        
                                        {/* Shift / Time Slot Row */}
                                        <td className="p-2 border-r border-gray-400 dark:border-zinc-700 w-1/3 align-middle bg-white dark:bg-[#161b22]">
                                            <div className="flex items-center justify-center space-x-2">
                                                {!isReadOnly && timeSlots.length > 1 && (
                                                    <button 
                                                        onClick={() => deleteTimeSlot(idx)} 
                                                        className="text-red-500 hover:text-red-700 font-bold select-none text-[12px] mr-1"
                                                        title="Remove Shift"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                                <span className="font-bold text-gray-500 dark:text-zinc-400 select-none">From:</span>
                                                {isReadOnly ? (
                                                    <span className="font-bold text-gray-900 dark:text-white">{slot.from || '—'}</span>
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        placeholder="Hrs" 
                                                        value={slot.from} 
                                                        onChange={(e) => updateTimeSlot(idx, 'from', e.target.value)} 
                                                        className="w-14 text-center border-b border-gray-400 dark:border-zinc-600 bg-transparent outline-none p-0 text-xs font-bold text-gray-900 dark:text-white focus:border-blue-500" 
                                                    />
                                                )}
                                                <span className="font-bold text-gray-500 dark:text-zinc-400 select-none">To:</span>
                                                {isReadOnly ? (
                                                    <span className="font-bold text-gray-900 dark:text-white">{slot.to || '—'}</span>
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        placeholder="Hrs" 
                                                        value={slot.to} 
                                                        onChange={(e) => updateTimeSlot(idx, 'to', e.target.value)} 
                                                        className="w-14 text-center border-b border-gray-400 dark:border-zinc-600 bg-transparent outline-none p-0 text-xs font-bold text-gray-900 dark:text-white focus:border-blue-500" 
                                                    />
                                                )}
                                            </div>
                                        </td>
                                        
                                        {/* Site Conditions: Single Line Horizontal Layout - RowSpan = timeSlots.length */}
                                        {idx === 0 && (
                                            <td rowSpan={timeSlots.length} className="p-2 border-gray-400 dark:border-zinc-700 w-1/3 align-middle bg-white dark:bg-[#161b22]">
                                                <div className="flex items-center justify-around h-full space-x-2">
                                                    <span className="font-bold text-gray-500 dark:text-zinc-400 select-none text-[11px]">Site Conditions:</span>
                                                    <label className="flex items-center space-x-1.5 cursor-pointer font-bold text-gray-800 dark:text-zinc-200">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={siteCondition === 'slushy'} 
                                                            disabled={isReadOnly}
                                                            onChange={() => setSiteCondition('slushy')}
                                                            className="w-3.5 h-3.5 text-blue-600 border-gray-300 dark:border-zinc-600 rounded focus:ring-blue-500 bg-transparent" 
                                                        />
                                                        <span>Slushy</span>
                                                    </label>
                                                    <label className="flex items-center space-x-1.5 cursor-pointer font-bold text-gray-800 dark:text-zinc-200">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={siteCondition === 'dry'} 
                                                            disabled={isReadOnly}
                                                            onChange={() => setSiteCondition('dry')}
                                                            className="w-3.5 h-3.5 text-blue-600 border-gray-300 dark:border-zinc-600 rounded focus:ring-blue-500 bg-transparent" 
                                                        />
                                                        <span>Dry</span>
                                                    </label>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Add Time Button */}
                        {!isReadOnly && (
                            <div className="absolute right-2 -bottom-6">
                                <button 
                                    onClick={addTimeSlot} 
                                    className="text-[9px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-extrabold uppercase tracking-widest flex items-center border border-gray-300 dark:border-zinc-700 bg-white dark:bg-[#161b22] px-2 py-0.5 shadow-sm rounded-md transition-all active:scale-95 hover:border-blue-500"
                                >
                                    <Plus size={10} className="mr-1" /> Add Time
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="h-6"></div> {/* spacer */}

                    {/* 4. Labour Report Table with Dynamic Configured Trades */}
                    <div className="relative">
                        <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[10px]">
                            <tbody>
                                {/* Header Row */}
                                <tr className="bg-gray-100/90 dark:bg-[#1f242c] font-bold border-b border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 select-none">
                                    <td 
                                        rowSpan={labourRows.length + 3} 
                                        style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
                                        className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold bg-gray-100/90 dark:bg-[#1f242c] border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 [writing-mode:vertical-lr] rotate-180 select-none align-middle"
                                    >
                                        LABOUR REPORT
                                    </td>
                                    <td className="p-2 border-r border-gray-400 dark:border-zinc-700 text-center font-bold w-44">Agency Name</td>
                                    {LABOUR_LABELS.map(lbl => (
                                        <td key={lbl} className="p-1 border-r border-gray-400 dark:border-zinc-700 text-center min-w-10 font-bold leading-tight">
                                            {lbl}
                                        </td>
                                    ))}
                                    <td className="p-2 border-r border-gray-400 dark:border-zinc-700 text-center w-14 font-bold">Total</td>
                                    <td className="p-2 text-left font-bold">Remarks</td>
                                </tr>

                                {/* Data Rows */}
                                {labourRows.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 border-b border-dashed border-gray-300 dark:border-zinc-700/80 text-gray-900 dark:text-white font-medium bg-white dark:bg-[#161b22]">
                                        {/* Agency Name Column */}
                                        <td className="p-1 border-r border-gray-400 dark:border-zinc-700 align-middle">
                                            {isReadOnly ? (
                                                <span className="p-1 font-bold text-gray-900 dark:text-white">{row.agency || '—'}</span>
                                            ) : (
                                                <div className="flex items-center space-x-1">
                                                    <button 
                                                        onClick={() => deleteLabourRow(rIdx)} 
                                                        className="text-red-500 hover:text-red-700 font-bold select-none text-[14px] px-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                                                        title="Remove Agency"
                                                    >
                                                        ×
                                                    </button>
                                                    <select
                                                        value={row.agency}
                                                        onChange={(e) => updateLabourRow(rIdx, 'agency', e.target.value)}
                                                        className="w-full bg-transparent border-none outline-none font-bold text-gray-900 dark:text-white focus:bg-blue-50/20 p-0.5 text-[11px] cursor-pointer"
                                                    >
                                                        <option value="" className="bg-white dark:bg-[#161b22] text-gray-400">-- Select Vendor / Agency --</option>
                                                        {row.agency && !systemAgencies.includes(row.agency) && !projectVendors.some(v => v.name === row.agency) && (
                                                            <option value={row.agency} className="bg-white dark:bg-[#161b22] text-gray-900 dark:text-white font-semibold">
                                                                {row.agency}
                                                            </option>
                                                        )}
                                                        <optgroup label="System / Departmental" className="bg-white dark:bg-[#161b22] text-gray-500 font-bold">
                                                            {systemAgencies.map(sys => (
                                                                <option key={sys} value={sys} className="bg-white dark:bg-[#161b22] text-gray-900 dark:text-white font-medium">{sys}</option>
                                                            ))}
                                                        </optgroup>
                                                        {projectVendors.length > 0 && (
                                                            <optgroup label="Project Vendors" className="bg-white dark:bg-[#161b22] text-blue-600 dark:text-blue-400 font-bold">
                                                                {projectVendors.map((pv) => (
                                                                    <option key={pv.pv_id || pv.name} value={pv.name} className="bg-white dark:bg-[#161b22] text-gray-900 dark:text-white font-medium">
                                                                        {pv.name} {pv.job_nature ? `(${pv.job_nature})` : ''}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </select>
                                                </div>
                                            )}
                                        </td>

                                        {/* Dynamic Trade Columns with Excel Selection & Keyboard Navigation */}
                                        {LABOUR_KEYS.map((key, cIdx) => {
                                            const isSelected = selectedCell?.row === rIdx && selectedCell?.col === cIdx;
                                            const isEditingThisCell = isSelected && isEditingCell;
                                            const val = row[key];

                                            return (
                                                <td 
                                                    key={key} 
                                                    onClick={() => handleCellClick(rIdx, cIdx)}
                                                    onDoubleClick={() => handleCellDoubleClick(rIdx, cIdx)}
                                                    className={`p-0.5 border-r border-gray-400 dark:border-zinc-700 text-center align-middle cursor-pointer transition-all select-none relative h-8 ${
                                                        isSelected 
                                                            ? 'bg-gray-300 dark:bg-zinc-700/80 ring-2 ring-blue-500 z-10 font-black text-gray-950 dark:text-white shadow-sm' 
                                                            : ''
                                                    }`}
                                                >
                                                    {isEditingThisCell ? (
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            autoFocus
                                                            value={val === 0 ? '' : val} 
                                                            onChange={(e) => updateLabourRow(rIdx, key, e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === 'Escape') {
                                                                    e.preventDefault();
                                                                    setIsEditingCell(false);
                                                                }
                                                            }}
                                                            onBlur={() => setIsEditingCell(false)}
                                                            className="w-full text-center bg-white dark:bg-[#161b22] border-2 border-blue-500 outline-none font-black p-0.5 text-xs text-gray-950 dark:text-white rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                        />
                                                    ) : (
                                                        <span className={`font-semibold ${val ? 'text-gray-950 dark:text-white font-extrabold' : 'text-gray-400 dark:text-zinc-600'}`}>
                                                            {val || ''}
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}

                                        {/* Row Total */}
                                        <td className="p-1 border-r border-gray-400 dark:border-zinc-700 text-center font-extrabold bg-gray-50/60 dark:bg-[#1f242c] align-middle">
                                            {getRowTotal(row) || ''}
                                        </td>

                                        {/* Remarks Input */}
                                        <td className="p-1 align-middle">
                                            {isReadOnly ? (
                                                <span className="p-1 text-gray-600 dark:text-zinc-400 font-normal">{row.remarks}</span>
                                            ) : (
                                                <input 
                                                    type="text" 
                                                    value={row.remarks} 
                                                    onChange={(e) => updateLabourRow(rIdx, 'remarks', e.target.value)} 
                                                    className="w-full text-left bg-transparent border-none outline-none focus:bg-blue-50/20 p-0.5 text-xs placeholder:text-[10px] placeholder:text-gray-400 dark:placeholder:text-zinc-500 placeholder:italic font-normal" 
                                                    placeholder="Remarks..." 
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                
                                {/* Total Row */}
                                <tr className="bg-gray-100/90 dark:bg-[#1f242c] border-t-2 border-b border-gray-400 dark:border-zinc-600 font-extrabold text-gray-900 dark:text-white select-none">
                                    <td className="p-2 border-r border-gray-400 dark:border-zinc-700 text-center font-bold">Total</td>
                                    {LABOUR_KEYS.map(key => (
                                        <td key={key} className="p-2 border-r border-gray-400 dark:border-zinc-700 text-center font-extrabold">
                                            {getColTotal(key) || ''}
                                        </td>
                                    ))}
                                    <td className="p-2 border-r border-gray-400 dark:border-zinc-700 text-center bg-gray-200/80 dark:bg-[#282e38] font-extrabold text-blue-600 dark:text-blue-400 text-xs">
                                        {getTotalManpowerToday()}
                                    </td>
                                    <td className="p-2"></td>
                                </tr>
                                
                                {/* Cumulative Manpower Row */}
                                <tr className="bg-gray-100/90 dark:bg-[#1f242c] font-bold text-gray-900 dark:text-white border-t border-gray-400 dark:border-zinc-700">
                                    <td colSpan={3} className="p-2 border-r border-gray-400 dark:border-zinc-700 text-left font-bold uppercase tracking-wider text-[9px] select-none">
                                        Cumulative Manpower up to last day
                                    </td>
                                    <td colSpan={3} className="p-1 border-r border-gray-400 dark:border-zinc-700 text-center align-middle bg-white dark:bg-[#161b22]">
                                        {isReadOnly ? (
                                            <span className="font-extrabold text-[11px]">{cumulativeLastDay.toLocaleString()}</span>
                                        ) : (
                                            <input 
                                                type="number" 
                                                min="0" 
                                                value={cumulativeLastDay} 
                                                onChange={(e) => setCumulativeLastDay(Math.max(0, parseInt(e.target.value) || 0))} 
                                                className="w-full text-center bg-transparent border-none outline-none font-extrabold text-gray-900 dark:text-white focus:bg-blue-50/20 p-0.5 text-[11px]" 
                                            />
                                        )}
                                    </td>
                                    <td colSpan={Math.max(1, LABOUR_KEYS.length - 2)} className="p-2 border-r border-gray-400 dark:border-zinc-700 text-left font-bold uppercase tracking-wider text-[9px] select-none">
                                        Cummlative manpower up to date
                                    </td>
                                    <td className="p-2 border-r border-gray-400 dark:border-zinc-700 text-center font-black text-green-600 dark:text-green-400 text-[11px] select-none bg-white dark:bg-[#161b22]">
                                        {cumulativeUpToDate.toLocaleString()}
                                    </td>
                                    <td className="p-2 bg-white dark:bg-[#161b22]"></td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Add Row Action Button */}
                        {!isReadOnly && (
                            <div className="absolute right-2 -bottom-6">
                                <button 
                                    onClick={addLabourRow} 
                                    className="text-[9px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-extrabold uppercase tracking-widest flex items-center border border-gray-300 dark:border-zinc-700 bg-white dark:bg-[#161b22] px-2 py-0.5 shadow-sm rounded-md transition-all active:scale-95 hover:border-blue-500"
                                >
                                    <Plus size={10} className="mr-1" /> Add Agency
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="h-6"></div> {/* spacer */}

                    {/* 5. Progress / Programme Table with Excel-like Cell Selection & Single Add Button */}
                    <div className="relative">
                        <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[10px]">
                            <tbody>
                                {/* Row 1: Section Header */}
                                <tr className="bg-gray-100/90 dark:bg-[#1f242c] font-bold border-b border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 select-none">
                                    <td 
                                        rowSpan={progressRows.length + 2} 
                                        style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
                                        className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold bg-gray-100/90 dark:bg-[#1f242c] border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 [writing-mode:vertical-lr] rotate-180 select-none align-middle"
                                    >
                                        PROGRESS / PROGRAMME
                                    </td>
                                    <td colSpan={4} className="p-2 border-r border-gray-400 dark:border-zinc-700 text-center uppercase tracking-widest text-[9px] font-bold">Today's Progress</td>
                                    <td colSpan={4} className="p-2 text-center uppercase tracking-widest text-[9px] font-bold">Tomorrow's Planning</td>
                                </tr>

                                {/* Row 2: Column Headers */}
                                <tr className="bg-gray-100/90 dark:bg-[#1f242c] font-bold border-b border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 select-none">
                                    <td className="p-1.5 border-r border-gray-400 dark:border-zinc-700 text-left w-[20%] font-bold">Activity / Item</td>
                                    <td className="p-1.5 border-r border-gray-400 dark:border-zinc-700 text-left w-[20%] font-bold">Description</td>
                                    <td className="p-1.5 border-r border-gray-400 dark:border-zinc-700 text-center w-12 font-bold">Unit</td>
                                    <td className="p-1.5 border-r border-gray-400 dark:border-zinc-700 text-center w-12 font-bold">Qty</td>
                                    
                                    <td className="p-1.5 border-r border-gray-400 dark:border-zinc-700 text-left w-[20%] font-bold">Activity / Item</td>
                                    <td className="p-1.5 border-r border-gray-400 dark:border-zinc-700 text-left w-[20%] font-bold">Description</td>
                                    <td className="p-1.5 border-r border-gray-400 dark:border-zinc-700 text-center w-12 font-bold">Unit</td>
                                    <td className="p-1.5 text-center w-12 font-bold">Qty</td>
                                </tr>

                                {/* Data Rows */}
                                {progressRows.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/30 border-b border-gray-400 dark:border-zinc-700 text-gray-900 dark:text-white bg-white dark:bg-[#161b22]">
                                        {PROGRESS_KEYS.map((key, cIdx) => {
                                            const isSelected = selectedProgressCell?.row === rIdx && selectedProgressCell?.col === cIdx;
                                            const isEditingThisCell = isSelected && isEditingProgressCell;
                                            const val = row[key];
                                            const isQtyCol = key === 'todayQty' || key === 'tomorrowQty';
                                            const isItemCol = key === 'todayItem' || key === 'tomorrowItem';

                                            return (
                                                <td 
                                                    key={key}
                                                    onClick={() => handleProgressCellClick(rIdx, cIdx)}
                                                    onDoubleClick={() => handleProgressCellDoubleClick(rIdx, cIdx)}
                                                    className={`p-0.5 border-r border-gray-400 dark:border-zinc-700 align-middle cursor-pointer transition-all select-none relative h-8 ${
                                                        isQtyCol ? 'text-center' : 'text-left'
                                                    } ${
                                                        isSelected 
                                                            ? 'bg-gray-300 dark:bg-zinc-700/80 ring-2 ring-blue-500 z-10 font-black text-gray-950 dark:text-white shadow-sm' 
                                                            : ''
                                                    }`}
                                                >
                                                    <div className="flex items-center h-full w-full">
                                                        {/* Delete Row button inside the first cell of each row */}
                                                        {cIdx === 0 && !isReadOnly && (
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    deleteProgressRow(rIdx);
                                                                }}
                                                                className="text-red-500 hover:text-red-700 font-bold select-none text-[14px] px-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors mr-0.5"
                                                                title="Remove Row"
                                                            >
                                                                ×
                                                            </button>
                                                        )}

                                                        {isEditingThisCell ? (
                                                            <input 
                                                                type={isQtyCol ? 'number' : 'text'}
                                                                min={isQtyCol ? '0' : undefined}
                                                                autoFocus
                                                                value={val}
                                                                onChange={(e) => updateProgressRowField(rIdx, key, e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                                                        e.preventDefault();
                                                                        setIsEditingProgressCell(false);
                                                                    }
                                                                }}
                                                                onBlur={() => setIsEditingProgressCell(false)}
                                                                className={`w-full bg-white dark:bg-[#161b22] border-2 border-blue-500 outline-none font-bold p-0.5 text-xs text-gray-950 dark:text-white rounded ${
                                                                    isQtyCol ? 'text-center font-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' : 'text-left'
                                                                }`}
                                                            />
                                                        ) : (
                                                            <span className={`w-full px-1 truncate ${
                                                                isItemCol 
                                                                    ? 'font-bold text-gray-900 dark:text-white' 
                                                                    : isQtyCol 
                                                                        ? `font-extrabold text-center ${key === 'todayQty' ? 'text-blue-600 dark:text-blue-400' : 'text-indigo-600 dark:text-indigo-400'}` 
                                                                        : 'text-gray-700 dark:text-zinc-300 font-medium'
                                                            }`}>
                                                                {val || ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Single Add Progress Row Button */}
                        {!isReadOnly && (
                            <div className="absolute right-2 -bottom-6">
                                <button 
                                    onClick={addProgressRow}
                                    className="text-[9px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-extrabold uppercase tracking-widest flex items-center border border-gray-300 dark:border-zinc-700 bg-white dark:bg-[#161b22] px-2.5 py-1 shadow-sm rounded-md transition-all active:scale-95 hover:border-blue-500"
                                >
                                    <Plus size={10} className="mr-1" /> Add Progress Row
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="h-6"></div> {/* spacer */}

                    {/* 6. Events / Visits Table (3 Default Rows) */}
                    <div className="relative">
                        <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[11px]">
                            <tbody>
                                {eventsList.map((evt, idx) => (
                                    <tr key={idx} className="border-b border-dotted border-gray-400 dark:border-zinc-700 hover:bg-gray-50/60 dark:hover:bg-zinc-800/30 bg-white dark:bg-[#161b22]">
                                        {idx === 0 && (
                                            <td 
                                                rowSpan={eventsList.length} 
                                                style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
                                                className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold bg-gray-100/90 dark:bg-[#1f242c] border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 [writing-mode:vertical-lr] rotate-180 select-none align-middle"
                                            >
                                                EVENTS / VISITS
                                            </td>
                                        )}
                                        <td className="p-1 text-left align-middle font-medium text-gray-800 dark:text-zinc-200">
                                            {isReadOnly ? (
                                                <span className="p-1 text-xs">{evt || '—'}</span>
                                            ) : (
                                                <div className="flex items-center space-x-1">
                                                    {eventsList.length > 1 && (
                                                        <button 
                                                            onClick={() => deleteEventRow(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold select-none text-[14px] px-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                                                            title="Remove Event"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                    <input 
                                                        type="text" 
                                                        value={evt} 
                                                        onChange={(e) => {
                                                            const updated = [...eventsList];
                                                            updated[idx] = e.target.value;
                                                            setEventsList(updated);
                                                        }} 
                                                        placeholder="Record details of visits, site coordinates, materials, quality inspections, etc."
                                                        className="w-full bg-transparent border-none outline-none focus:bg-blue-50/20 p-0.5 text-xs text-gray-900 dark:text-white placeholder:text-[10px] placeholder:text-gray-400 dark:placeholder:text-zinc-500 placeholder:italic font-normal" 
                                                    />
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Add Event Button */}
                        {!isReadOnly && (
                            <div className="absolute right-2 -bottom-6">
                                <button 
                                    onClick={addEventRow}
                                    className="text-[9px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-extrabold uppercase tracking-widest flex items-center border border-gray-300 dark:border-zinc-700 bg-white dark:bg-[#161b22] px-2 py-0.5 shadow-sm rounded-md transition-all active:scale-95 hover:border-blue-500"
                                >
                                    <Plus size={10} className="mr-1" /> Add Event
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="h-6"></div> {/* spacer */}

                    {/* 7. Remarks & Footers Table with Dynamic Distribution & Prepared By Options */}
                    <div className="relative">
                        <table className="w-full border-collapse border-t-0 border border-gray-400 dark:border-zinc-700 text-[11px]">
                            <tbody>
                                {remarksList.map((rem, idx) => (
                                    <tr key={idx} className="border-b border-dotted border-gray-400 dark:border-zinc-700 hover:bg-gray-50/60 dark:hover:bg-zinc-800/30 bg-white dark:bg-[#161b22]">
                                        {/* Vertical Header */}
                                        {idx === 0 && (
                                            <td 
                                                rowSpan={remarksList.length} 
                                                style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}
                                                className="w-[40px] min-w-[40px] max-w-[40px] text-center font-bold bg-gray-100/90 dark:bg-[#1f242c] border-r border-gray-400 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 [writing-mode:vertical-lr] rotate-180 select-none align-middle"
                                            >
                                                REMARKS
                                            </td>
                                        )}

                                        {/* Remarks Input line */}
                                        <td className="p-1 text-left align-middle font-medium text-gray-800 dark:text-zinc-200">
                                            {isReadOnly ? (
                                                <span className="p-1 text-xs">{rem || '—'}</span>
                                            ) : (
                                                <div className="flex items-center space-x-1">
                                                    {remarksList.length > 1 && (
                                                        <button 
                                                            onClick={() => deleteRemarkRow(idx)}
                                                            className="text-red-500 hover:text-red-700 font-bold select-none text-[14px] px-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                                                            title="Remove Remark"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                    <input 
                                                        type="text" 
                                                        value={rem} 
                                                        onChange={(e) => {
                                                            const updated = [...remarksList];
                                                            updated[idx] = e.target.value;
                                                            setRemarksList(updated);
                                                        }} 
                                                        placeholder="Enter safety notes, bottleneck details, critical milestones, client decisions, etc."
                                                        className="w-full bg-transparent border-none outline-none focus:bg-blue-50/20 p-0.5 text-xs text-gray-900 dark:text-white placeholder:text-[10px] placeholder:text-gray-400 dark:placeholder:text-zinc-500 placeholder:italic font-normal" 
                                                    />
                                                </div>
                                            )}
                                        </td>

                                        {/* Right 3 Columns: Distribution, Prepared by, MANO - Dynamic Configured Presets */}
                                        {idx === 0 && (
                                            <>
                                                {/* Distribution Cell */}
                                                <td 
                                                    rowSpan={remarksList.length} 
                                                    className="w-36 border-l border-r border-gray-400 dark:border-zinc-700 p-2 align-top bg-white dark:bg-[#161b22]"
                                                >
                                                    <div className="flex flex-col justify-between h-full space-y-2">
                                                        <span className="font-serif text-[11px] text-gray-800 dark:text-zinc-200 select-none">Distribution:</span>
                                                        <div className="flex items-center space-x-1.5 pt-1">
                                                            <div className="w-4 h-4 bg-[#7a8b9e] dark:bg-zinc-600 border border-gray-600 select-none flex-shrink-0"></div>
                                                            {isReadOnly ? (
                                                                <span className="font-serif text-[11px] text-gray-900 dark:text-white font-bold">{distribution}</span>
                                                            ) : (
                                                                <select 
                                                                    value={distribution} 
                                                                    onChange={(e) => setDistribution(e.target.value)} 
                                                                    className="bg-transparent border-none outline-none font-serif text-[11px] font-bold text-gray-900 dark:text-white focus:bg-blue-50/20 w-full cursor-pointer"
                                                                >
                                                                    {configuredDistributions.map(d => (
                                                                        <option key={d} value={d} className="bg-white dark:bg-[#161b22] text-gray-900 dark:text-white font-semibold">
                                                                            {d}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Prepared by Cell */}
                                                <td 
                                                    rowSpan={remarksList.length} 
                                                    className="w-36 border-r border-gray-400 dark:border-zinc-700 p-2 align-top bg-white dark:bg-[#161b22]"
                                                >
                                                    <div className="flex flex-col justify-between h-full space-y-2">
                                                        <span className="font-serif text-[11px] text-gray-800 dark:text-zinc-200 select-none">Prepared by:</span>
                                                        <div className="flex items-center space-x-1.5 pt-1">
                                                            {isReadOnly ? (
                                                                <span className="font-serif text-[11px] text-gray-900 dark:text-white font-bold">{preparedBy}</span>
                                                            ) : (
                                                                <select 
                                                                    value={preparedBy} 
                                                                    onChange={(e) => setPreparedBy(e.target.value)} 
                                                                    className="bg-transparent border-none outline-none font-serif text-[11px] font-bold text-gray-900 dark:text-white focus:bg-blue-50/20 w-full cursor-pointer"
                                                                >
                                                                    {configuredPreparedBys.map(p => (
                                                                        <option key={p} value={p} className="bg-white dark:bg-[#161b22] text-gray-900 dark:text-white font-semibold">
                                                                            {p}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                            <div className="w-4 h-4 bg-[#7a8b9e] dark:bg-zinc-600 border border-gray-600 select-none flex-shrink-0"></div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* MANO Cell */}
                                                <td 
                                                    rowSpan={remarksList.length} 
                                                    className="w-28 border-r border-gray-400 dark:border-zinc-700 p-2 align-top bg-white dark:bg-[#161b22] text-center"
                                                >
                                                    <div className="flex flex-col justify-between h-full">
                                                        <span className="font-serif text-[11px] font-normal text-gray-900 dark:text-white tracking-wider select-none">MANO</span>
                                                        <div></div>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Add Remark Button */}
                        {!isReadOnly && (
                            <div className="absolute left-12 -bottom-6">
                                <button 
                                    onClick={addRemarkRow}
                                    className="text-[9px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-extrabold uppercase tracking-widest flex items-center border border-gray-300 dark:border-zinc-700 bg-white dark:bg-[#161b22] px-2 py-0.5 shadow-sm rounded-md transition-all active:scale-95 hover:border-blue-500"
                                >
                                    <Plus size={10} className="mr-1" /> Add Remark
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Bottom Actions if not readonly */}
            {!isReadOnly && (
                <div className="bg-white dark:bg-[#161b22] border-t border-gray-200 dark:border-white/5 px-6 py-4 flex justify-center">
                    <button 
                        onClick={handleFinalize}
                        className="px-12 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 flex items-center space-x-2.5 active:scale-95 transition-all"
                    >
                        <Send size={16} />
                        <span>Finalize Daily Progress Report</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default DPRCreate;
