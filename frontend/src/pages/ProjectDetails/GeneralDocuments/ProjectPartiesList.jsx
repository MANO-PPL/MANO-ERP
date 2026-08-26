import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
    Search, Plus, Trash2, Info, RefreshCw, X, UploadCloud,
    Download, Save, RotateCcw, AlertCircle, ChevronDown, Copy, Eye, CheckSquare,
    Square, ArrowUp, ArrowDown, Filter, Sparkles, Check, Building2, Briefcase, Tag,
    ArrowLeft, Clock, Layers, ChevronLeft, ChevronRight, UserPlus, CheckCircle2,
    SlidersHorizontal, FileSpreadsheet, ClipboardPaste, FileText, CheckCircle
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import api from '../../../services/api';
import { generalDocsApi } from '../../../services/generalDocsApi';
import { workflowApi } from '../../../services/workflowApi';
import WorkflowPanel from '../../../components/WorkflowPanel';
import DuplicateResolverModal from '../../../components/DuplicateResolverModal';
import ConfirmModal from '../../../components/ConfirmModal';
import Toast from '../../../components/Toast';

const CATEGORY_OPTIONS = [
    'Client',
    'PMC',
    'Contractor',
    'Supplier',
    'Consultant',
    'Manufacturer',
    'Service Provider',
    'Other'
];

const CATEGORY_BADGE_STYLES = {
    Client: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20',
    PMC: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border-violet-200/80 dark:border-violet-500/20',
    Contractor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200/80 dark:border-amber-500/20',
    Supplier: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200/80 dark:border-blue-500/20',
    Consultant: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400 border-cyan-200/80 dark:border-cyan-500/20',
    Manufacturer: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-500/20',
    'Service Provider': 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 border-fuchsia-200/80 dark:border-fuchsia-500/20',
    Other: 'bg-gray-50 text-gray-700 dark:bg-white/5 dark:text-gray-400 border-gray-200/80 dark:border-white/10'
};

const CATEGORY_DOT_COLORS = {
    Client: 'bg-emerald-500',
    PMC: 'bg-violet-500',
    Contractor: 'bg-amber-500',
    Supplier: 'bg-blue-500',
    Consultant: 'bg-cyan-500',
    Manufacturer: 'bg-indigo-500',
    'Service Provider': 'bg-fuchsia-500',
    Other: 'bg-gray-500'
};

// In-memory & SessionStorage cache for CRM contacts
const CRM_CONTACTS_MEMORY_CACHE = new Map();
const CRM_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

const getCachedCrmData = (projectId) => {
    const mem = CRM_CONTACTS_MEMORY_CACHE.get(String(projectId));
    if (mem && (Date.now() - mem.timestamp < CRM_CACHE_TTL_MS)) {
        return mem;
    }
    try {
        const raw = sessionStorage.getItem(`mano_crm_contacts_cache_${projectId}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.contacts && (Date.now() - parsed.timestamp < CRM_CACHE_TTL_MS)) {
                CRM_CONTACTS_MEMORY_CACHE.set(String(projectId), parsed);
                return parsed;
            }
        }
    } catch (e) {}
    return null;
};

const setCachedCrmData = (projectId, contacts, jobNatures) => {
    const data = {
        contacts,
        jobNatures,
        timestamp: Date.now()
    };
    CRM_CONTACTS_MEMORY_CACHE.set(String(projectId), data);
    try {
        sessionStorage.setItem(`mano_crm_contacts_cache_${projectId}`, JSON.stringify(data));
    } catch (e) {}
};

const GRID_COLUMNS = [
    'name',
    'category',
    'job_name',
    'contact_person',
    'designation',
    'telephone_no',
    'email',
    'address',
    'remarks'
];

const COLUMN_LABELS = {
    name: 'Company Name',
    category: 'Category',
    job_name: 'Nature of Job',
    contact_person: 'Contact Person',
    designation: 'Designation',
    telephone_no: 'Contact No',
    email: 'Email ID',
    address: 'Address',
    remarks: 'Remarks'
};

const COLUMN_WIDTH_CLASSES = {
    name: 'w-[220px] min-w-[200px]',
    category: 'w-[140px] min-w-[140px]',
    job_name: 'w-[180px] min-w-[170px]',
    contact_person: 'w-[160px] min-w-[150px]',
    designation: 'w-[150px] min-w-[140px]',
    telephone_no: 'w-[140px] min-w-[140px]',
    email: 'w-[190px] min-w-[180px]',
    address: 'w-[240px] min-w-[220px]',
    remarks: 'w-[200px] min-w-[180px]'
};

const COLUMN_ALIASES = {
    name: [
        'company name', 'company', 'name', 'party name', 'party', 'vendor name', 
        'vendor', 'client name', 'client', 'firm name', 'firm', 'agency', 
        'contractor name', 'organization', 'subcontractor', 'business name'
    ],
    category: [
        'category', 'party category', 'type', 'party type', 'role', 
        'classification', 'department', 'party role'
    ],
    job_name: [
        'nature of job', 'job nature', 'job name', 'nature of work', 'scope of work', 
        'scope', 'trade', 'work nature', 'service', 'job', 'discipline', 'activity'
    ],
    contact_person: [
        'contact person', 'contact name', 'person name', 'poc', 'representative', 
        'person', 'contact', 'authorized person', 'name of person', 'key person'
    ],
    designation: [
        'designation', 'position', 'role / designation', 'title', 'job title', 'post'
    ],
    telephone_no: [
        'contact no', 'contact number', 'phone no', 'phone number', 'mobile no', 
        'mobile number', 'telephone no', 'telephone', 'mobile', 'phone', 'tel', 
        'cell', 'contact_no', 'phone_no'
    ],
    email: [
        'email id', 'email', 'e-mail', 'mail id', 'mail', 'email address', 'e-mail id'
    ],
    address: [
        'address', 'office address', 'location', 'site address', 'city', 
        'full address', 'street address', 'work address'
    ],
    remarks: [
        'remarks', 'notes', 'comments', 'description', 'remark', 'note', 'details'
    ]
};

const matchColumnHeader = (headerText) => {
    if (!headerText || typeof headerText !== 'string') return null;
    const clean = headerText.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) return null;

    for (const [colKey, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of aliases) {
            const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (clean === cleanAlias || clean.includes(cleanAlias) || cleanAlias.includes(clean)) {
                return colKey;
            }
        }
    }
    return null;
};

// 10 Comprehensive, Realistic Construction ERP Dummy Parties
const DUMMY_PROJECT_PARTIES = [
    {
        name: 'Skyline Developers & Infrastructure Ltd',
        category: 'Client',
        job_name: 'Project Ownership & Principal Client',
        contact_person: 'Mr. Rajesh Sharma',
        designation: 'Managing Director',
        telephone_no: '+91 9820123456',
        email: 'rajesh.sharma@skylinedev.com',
        address: 'Tower A, Bandra Kurla Complex, Mumbai 400051',
        remarks: 'Principal Employer / Project Owner'
    },
    {
        name: 'Vertex Project Management Consultants',
        category: 'PMC',
        job_name: 'Project Management & Site Quality Supervision',
        contact_person: 'Ms. Priya Nair',
        designation: 'Chief Project Lead',
        telephone_no: '+91 9840234567',
        email: 'priya.nair@vertexpmc.com',
        address: 'Sector 18, Cyber City, Gurgaon 122002',
        remarks: 'Overall Site Quality & Schedule Control'
    },
    {
        name: 'Apex Civil Structures & Contracting Ltd',
        category: 'Contractor',
        job_name: 'Main Civil, Substructure & RCC Core Works',
        contact_person: 'Mr. Amit Patel',
        designation: 'Project Director',
        telephone_no: '+91 9712345678',
        email: 'amit.patel@apexcivil.in',
        address: 'Plot 45, GIDC Industrial Zone, Ahmedabad 382445',
        remarks: 'Primary RCC, Piling & Structural Contractor'
    },
    {
        name: 'Delta MEP Engineering Solutions Pvt Ltd',
        category: 'Contractor',
        job_name: 'Turnkey HVAC, Electrical & Plumbing Works',
        contact_person: 'Mr. Karthik Sundaram',
        designation: 'Senior MEP Lead',
        telephone_no: '+91 9444123890',
        email: 'karthik@deltamep.com',
        address: 'Mount Road, Anna Salai, Chennai 600002',
        remarks: 'High Voltage & Fire Fighting Integration'
    },
    {
        name: 'UltraTech Concrete & Cement Solutions',
        category: 'Supplier',
        job_name: 'Ready Mix Concrete (M40, M50 Grade)',
        contact_person: 'Mr. Suresh Verma',
        designation: 'Regional Supply Manager',
        telephone_no: '+91 9811098765',
        email: 'suresh.verma@ultratech.com',
        address: 'MIDC Andheri East, Mumbai 400069',
        remarks: 'Dedicated Batching Plant Supplier'
    },
    {
        name: 'Tata Steel BSL Rebars & Structurals',
        category: 'Supplier',
        job_name: 'TMT Fe550D High-Strength Steel Rebars',
        contact_person: 'Mr. Vikas Gupta',
        designation: 'Industrial Sales Head',
        telephone_no: '+91 9321456789',
        email: 'vikas.g@tatasteel.com',
        address: 'Main Plant Road, Jamshedpur 831001',
        remarks: 'Primary Structural Steel Supply'
    },
    {
        name: 'Geotech Soil & Foundation Experts LLP',
        category: 'Consultant',
        job_name: 'Soil Investigation, Bore Hole & Pile Load Testing',
        contact_person: 'Dr. Sunita Kulkarni',
        designation: 'Principal Geotechnical Consultant',
        telephone_no: '+91 9823012345',
        email: 'sunita@geotechexperts.in',
        address: 'FC Road, Shivaji Nagar, Pune 411005',
        remarks: 'Foundations & Shoring Design Sign-off'
    },
    {
        name: 'Matrix Architectural Façade & Glazing',
        category: 'Manufacturer',
        job_name: 'Unitized Curtain Wall & Double Glazing Systems',
        contact_person: 'Mr. Rohan Mehra',
        designation: 'Technical Operations Director',
        telephone_no: '+91 9930456123',
        email: 'rohan.mehra@matrixfacade.com',
        address: 'Phase 2, Okhla Industrial Area, New Delhi 110020',
        remarks: 'Façade Fabrication & On-site Erection'
    },
    {
        name: 'SafeShield Fire Safety & Surveillance Systems',
        category: 'Service Provider',
        job_name: 'Fire Hydrant, Sprinklers & CCTV Commissioning',
        contact_person: 'Mr. Deepak Joshi',
        designation: 'Chief Safety Engineer',
        telephone_no: '+91 9876501234',
        email: 'deepak.joshi@safeshield.in',
        address: 'Salt Lake Sector V, Kolkata 700091',
        remarks: 'Statutory Fire NOC & Testing Partner'
    },
    {
        name: 'EcoGreen Landscaping & Environmental Services',
        category: 'Other',
        job_name: 'Horticulture, Rainwater Harvesting & Landscape',
        contact_person: 'Ms. Ananya Roy',
        designation: 'Landscape Architect',
        telephone_no: '+91 9831234567',
        email: 'ananya@ecogreen.co.in',
        address: 'Koramangala 4th Block, Bengaluru 560034',
        remarks: 'Green Building & IGBC Gold Landscape'
    }
];

const downloadExcelTemplateFile = (includeDummyData = true) => {
    const headers = [
        'Company Name',
        'Category',
        'Nature of Job',
        'Contact Person',
        'Designation',
        'Contact No',
        'Email ID',
        'Address',
        'Remarks'
    ];

    const dataRows = includeDummyData
        ? DUMMY_PROJECT_PARTIES.map(p => [
            p.name,
            p.category,
            p.job_name,
            p.contact_person,
            p.designation,
            p.telephone_no,
            p.email,
            p.address,
            p.remarks
        ])
        : [];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    ws['!cols'] = [
        { wch: 38 }, // Company Name
        { wch: 18 }, // Category
        { wch: 36 }, // Nature of Job
        { wch: 24 }, // Contact Person
        { wch: 24 }, // Designation
        { wch: 20 }, // Contact No
        { wch: 32 }, // Email ID
        { wch: 44 }, // Address
        { wch: 34 }  // Remarks
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Project Parties');

    const filename = includeDummyData
        ? 'MANO_Project_Parties_Sample_Data.xlsx'
        : 'MANO_Project_Parties_Template.xlsx';

    XLSX.writeFile(wb, filename);
};

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

const resolvePartyCategory = (rawVal) => {
    if (!rawVal) return 'Contractor';
    const clean = String(rawVal).trim();
    const lower = clean.toLowerCase();
    const matched = CATEGORY_OPTIONS.find(c => c.toLowerCase() === lower);
    if (matched) return matched;
    if (lower === 'client' || lower.startsWith('cli')) return 'Client';
    if (lower === 'pmc' || lower.includes('project management')) return 'PMC';
    if (lower.startsWith('contr') || lower === 'sub-contractor' || lower === 'subcontractor' || lower.startsWith('sub')) return 'Contractor';
    if (lower.startsWith('supp') || lower === 'vendor' || lower.includes('supply')) return 'Supplier';
    if (lower.startsWith('consult')) return 'Consultant';
    if (lower.startsWith('manuf') || lower.startsWith('mfg')) return 'Manufacturer';
    if (lower.startsWith('serv') || lower.includes('service')) return 'Service Provider';
    return clean || 'Other';
};

const CustomCheckbox = ({ checked, onChange, title }) => (
    <div
        onClick={onChange}
        title={title}
        className={`w-4 h-4 rounded border transition-all flex items-center justify-center cursor-pointer select-none ${checked
            ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 shadow-xs shadow-blue-500/20'
            : 'border-gray-300 dark:border-white/20 bg-white dark:bg-[#161b22] hover:border-blue-400'
            }`}
    >
        {checked && <Check size={11} className="stroke-[3]" />}
    </div>
);

const CustomPageSizeDropdown = ({ pageSize, setPageSize, totalCount }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const options = [50, 100, 250, 500, 'All'];

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
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all shadow-xs cursor-pointer"
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

/* ---- Interactive Inline Category Selector Dropdown ---- */
const InlineCategorySelector = ({ value, onChange, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);

    const updateCoords = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX
            });
        }
    }, []);

    const handleToggle = (e) => {
        e.stopPropagation();
        if (disabled) return;
        if (!isOpen) updateCoords();
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (triggerRef.current && !triggerRef.current.contains(e.target) && !e.target.closest('.category-portal-dropdown')) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const currentStyle = CATEGORY_BADGE_STYLES[value] || CATEGORY_BADGE_STYLES.Other;
    const currentDot = CATEGORY_DOT_COLORS[value] || CATEGORY_DOT_COLORS.Other;

    return (
        <div ref={triggerRef} className="relative inline-block">
            <button
                type="button"
                onClick={handleToggle}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer select-none hover:shadow-xs active:scale-95 ${currentStyle}`}
                title="Click to change category"
            >
                <span className={`w-1.5 h-1.5 rounded-full ${currentDot}`} />
                <span>{value || 'Contractor'}</span>
                <ChevronDown size={11} className={`opacity-60 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && ReactDOM.createPortal(
                <div
                    className="category-portal-dropdown fixed w-48 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[9999] py-1 text-xs font-semibold overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none flex flex-col"
                    style={{
                        top: coords.top - window.scrollY,
                        left: coords.left - window.scrollX
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-white/5">
                        Select Category
                    </div>
                    {CATEGORY_OPTIONS.map(cat => {
                        const isSelected = value === cat;
                        const dotColor = CATEGORY_DOT_COLORS[cat] || CATEGORY_DOT_COLORS.Other;
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                    onChange(cat);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center justify-between transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/70 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                    <span>{cat}</span>
                                </span>
                                {isSelected && <Check size={13} className="stroke-[3]" />}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

const ProjectPartiesList = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const tableContainerRef = useRef(null);
    const fileInputRef = useRef(null);

    const getInitialDraftState = () => {
        try {
            sessionStorage.removeItem(`mano_project_parties_draft_grid_${projectId}`);
            sessionStorage.removeItem(`mano_project_parties_draft_deleted_${projectId}`);
        } catch (e) { }

        return {
            draftGrid: [],
            draftDeleted: new Set()
        };
    };

    const initialDraft = getInitialDraftState();

    // Parties server state
    const [parties, setParties] = useState([]);
    const partiesRef = useRef(parties);
    partiesRef.current = parties;

    const [allAvailableCrmContacts, setAllAvailableCrmContacts] = useState([]);
    const [allJobNatures, setAllJobNatures] = useState([]);

    // Workflow state
    const [workflowState, setWorkflowState] = useState({ mode: 'read', cycleId: null, instanceId: null, loading: false, notConfigured: true });
    const isEditable = canWrite && (workflowState.notConfigured || (workflowState.mode === 'edit' && workflowState.cycleId));

    // Spreadsheet grid state
    const [gridData, setGridData] = useState(initialDraft.draftGrid);
    const gridDataRef = useRef(gridData);
    gridDataRef.current = gridData;

    // Deleted IDs tracking for manual save
    const [deletedIds, setDeletedIds] = useState(initialDraft.draftDeleted);
    const deletedIdsRef = useRef(deletedIds);
    deletedIdsRef.current = deletedIds;

    // Original database data map for dirty comparison
    const originalPartiesMap = useMemo(() => {
        const map = new Map();
        parties.forEach(p => {
            if (p && p.id) map.set(p.id, p);
        });
        return map;
    }, [parties]);

    // Check if a row differs from its original database record
    const isPartyRowDirty = (row, originalParty) => {
        if (!row) return false;
        if (!originalParty) {
            return row._status === 'new' && Boolean(row.name && row.name.trim());
        }
        if (row._status === 'new') {
            return Boolean(row.name && row.name.trim());
        }
        return GRID_COLUMNS.some(col => {
            const curVal = String(row[col] ?? '').trim();
            const origVal = String(originalParty[col] ?? '').trim();
            return curVal !== origVal;
        });
    };

    const { hasUnsavedChanges, unsavedCount } = useMemo(() => {
        if (deletedIds.size === 0 && gridData.length === parties.length && gridData.every(r => r._status === 'saved')) {
            return { hasUnsavedChanges: false, unsavedCount: 0 };
        }
        let dirtyCount = 0;
        for (let i = 0; i < gridData.length; i++) {
            const row = gridData[i];
            if (row._status === 'new') {
                if (row.name && row.name.trim()) dirtyCount++;
            } else if (row._status === 'modified' || row._status === 'error') {
                const original = originalPartiesMap.get(row.id);
                if (isPartyRowDirty(row, original)) dirtyCount++;
            }
        }
        const total = dirtyCount + deletedIds.size;
        return { hasUnsavedChanges: total > 0, unsavedCount: total };
    }, [gridData, originalPartiesMap, deletedIds, parties.length]);

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

    // Helper to get target index right below current cursor/selection
    const getTargetInsertIndex = () => {
        const b = getBoundsFromRefs();
        const anchor = selectionAnchorRef.current;
        let activeSortedRowIdx = -1;
        if (b) {
            activeSortedRowIdx = b.maxRow;
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

    // Right Click Context Menu State
    const [contextMenu, setContextMenu] = useState(null);

    // Multi-row Checkbox Selection
    const [selectedIds, setSelectedIds] = useState(new Set());
    selectedIdsRef.current = selectedIds;
    const [lastSelectedId, setLastSelectedId] = useState(null);

    // Filter, Search, Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    // UI Loading & Dropdowns
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const addMenuRef = useRef(null);

    // Excel Tools & Right Sidebar Drawer State
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [isExcelDropdownOpen, setIsExcelDropdownOpen] = useState(false);
    const excelDropdownRef = useRef(null);
    const [excelPasteText, setExcelPasteText] = useState('');
    const [excelParsedParties, setExcelParsedParties] = useState([]);
    const [excelSourceFileName, setExcelSourceFileName] = useState('');
    const [excelImportMode, setExcelImportMode] = useState('append'); // 'append' | 'replace'
    const [excelModalTab, setExcelModalTab] = useState('upload'); // 'upload' | 'paste'

    // Duplicate Resolver Modal State
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    // CRM Categorized Picker Modal
    const [isCrmPickerOpen, setIsCrmPickerOpen] = useState(false);
    const [crmPickerCategory, setCrmPickerCategory] = useState('All');
    const [crmPickerSearch, setCrmPickerSearch] = useState('');
    const [crmSelectedIds, setCrmSelectedIds] = useState(new Set());

    // Bulk Floating Bar Actions
    const [showBulkCategoryMenu, setShowBulkCategoryMenu] = useState(false);

    // Toast
    const [toast, setToast] = useState(null);
    const showToast = (type, title, message, duration = 3500) => {
        setToast({ type, title, message, duration, id: Date.now() });
    };

    // Confirm Modal
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

    const handleUndo = () => {
        if (cellEditInitialStateRef.current) {
            handleCellBlur();
        }
        if (undoStackRef.current.length === 0) {
            showToast('info', '', 'No previous actions to undo');
            return;
        }
        const currentState = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
        redoStackRef.current.push(currentState);
        const previousState = undoStackRef.current.pop();
        setGridData(previousState);
        showToast('sparkle', '', 'Undo successful');
    };

    const handleRedo = () => {
        if (cellEditInitialStateRef.current) {
            handleCellBlur();
        }
        if (redoStackRef.current.length === 0) {
            showToast('info', '', 'No actions to redo');
            return;
        }
        const currentState = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
        undoStackRef.current.push(currentState);
        const nextState = redoStackRef.current.pop();
        setGridData(nextState);
        showToast('sparkle', '', 'Redo successful');
    };

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Project Parties' }
        ]);
    }, [setExtraBreadcrumbs, projectId]);

    // Close Dropdowns & Context Menu on Click Outside
    useEffect(() => {
        const handleCloseMenu = (e) => {
            if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
                setIsAddMenuOpen(false);
            }
            if (excelDropdownRef.current && !excelDropdownRef.current.contains(e.target)) {
                setIsExcelDropdownOpen(false);
            }
            if (!e.target.closest('[data-context-menu="true"]')) {
                setContextMenu(null);
            }
            if (!e.target.closest('td[id^="cell-"]') && !e.target.closest('.category-portal-dropdown') && !e.target.closest('[role="dialog"]')) {
                setSelectionAnchor(null);
                setSelectionFocus(null);
                setEditingCell(null);
            }
        };
        document.addEventListener('mousedown', handleCloseMenu);
        return () => document.removeEventListener('mousedown', handleCloseMenu);
    }, []);

    // Global MouseUp for range drag selection
    useEffect(() => {
        const handleGlobalMouseUp = () => setIsMouseDown(false);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // High-performance viewport scroll & auto-focus engine
    useEffect(() => {
        if (selectionFocus && sortedGridDataRef.current && sortedGridDataRef.current[selectionFocus.r]) {
            const colName = GRID_COLUMNS[selectionFocus.c];
            if (colName) {
                const cellEl = document.getElementById(`cell-${selectionFocus.r}-${colName}`);
                if (cellEl && document.activeElement !== cellEl && !editingCell) {
                    cellEl.focus({ preventScroll: true });
                    cellEl.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
                }
            }
        }
    }, [selectionFocus, editingCell]);

    // Handle workflow state change with equality check to prevent re-render loops
    const handleWorkflowStateChange = useCallback((newState) => {
        setWorkflowState(prev => {
            if (
                prev.mode === newState.mode &&
                prev.cycleId === newState.cycleId &&
                prev.instanceId === newState.instanceId &&
                prev.loading === newState.loading &&
                prev.notConfigured === newState.notConfigured &&
                prev.notInitialized === newState.notInitialized
            ) {
                return prev;
            }
            return { ...prev, ...newState };
        });
    }, []);

    // Fetch CRM available contacts for lookup (cached)
    const fetchAvailableContacts = useCallback(async (force = false) => {
        if (!force) {
            const cached = getCachedCrmData(projectId);
            if (cached) {
                setAllAvailableCrmContacts(cached.contacts);
                setAllJobNatures(cached.jobNatures);
                return;
            }
        }

        try {
            let rawList = [];
            try {
                const res = await generalDocsApi.getAvailableParties(projectId, { limit: 5000 });
                rawList = res.parties || res.contacts || [];
            } catch (err) {
                console.warn('getAvailableParties fallback', err);
            }

            if (rawList.length === 0) {
                try {
                    const [vRes, cRes] = await Promise.allSettled([
                        api.get('/vendors?limit=1000'),
                        api.get('/clients?limit=1000')
                    ]);
                    const vList = vRes.status === 'fulfilled' ? (vRes.value.data?.vendors || vRes.value.data?.data || []) : [];
                    const cList = cRes.status === 'fulfilled' ? (cRes.value.data?.clients || cRes.value.data?.data || []) : [];
                    rawList = [...vList, ...cList];
                } catch (fallbackErr) {
                    console.warn('Vendor/Client fallback fetch error', fallbackErr);
                }
            }

            const seenIds = new Set();
            const mapped = [];
            rawList.forEach(c => {
                const id = c.id || c.vendors_id || c.client_id;
                if (!id || seenIds.has(id)) return;
                seenIds.add(id);

                mapped.push({
                    id,
                    contact_id: id,
                    name: c.name || c.company_name || '',
                    category: resolvePartyCategory(c.category || c.contact_category || (c.client_id ? 'Client' : 'Supplier')),
                    job_name: c.job_nature || c.job_name || c.nature_of_job || '',
                    contact_person: c.contact_person || c.contact || '',
                    designation: c.designation || '',
                    telephone_no: c.mobile || c.telephone_no || c.contact_no || '',
                    email: c.email || '',
                    address: c.address || c.location || '',
                    remarks: c.remarks || ''
                });
            });

            const validContacts = mapped.filter(c => Boolean(c.name));
            setAllAvailableCrmContacts(validContacts);

            const jobSet = new Set();
            validContacts.forEach(c => {
                if (c.job_name && c.job_name.trim()) jobSet.add(c.job_name.trim());
            });
            const validJobNatures = Array.from(jobSet).map(j => ({ job_id: j, job_name: j }));
            setAllJobNatures(validJobNatures);

            setCachedCrmData(projectId, validContacts, validJobNatures);
        } catch (e) {
            console.error('Failed to load available CRM contacts', e);
        }
    }, [projectId]);

    // Fetch Server Parties
    const fetchParties = useCallback(async (isManualRefresh = false) => {
        // Only trigger full skeleton loading if no parties data is currently loaded
        if (partiesRef.current.length === 0 && !isManualRefresh) {
            setIsLoading(true);
        }
        try {
            let serverParties = [];

            if (workflowState && workflowState.instanceId && !workflowState.notConfigured) {
                try {
                    let rows = [];
                    if (workflowState.cycleId) {
                        try {
                            const res = await workflowApi.getDraftContent(workflowState.instanceId);
                            rows = res.content_tables?.pdoc_vendors || [];
                        } catch (err) {
                            const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                            rows = res.content?.pdoc_vendors || [];
                        }
                    } else {
                        const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                        rows = res.content?.pdoc_vendors || [];
                    }

                    if (rows.length > 0) {
                        serverParties = rows.map(p => ({
                            id: p.pv_id,
                            party_id: p.vendors_id || p.id,
                            name: p.name || p.company_name || '',
                            category: resolvePartyCategory(p.category || 'Contractor'),
                            job_name: p.job_nature || p.job_name || '',
                            contact_person: p.contact_person || '',
                            designation: p.designation || '',
                            telephone_no: p.mobile || p.telephone_no || '',
                            email: p.email || '',
                            address: p.address || '',
                            remarks: p.remarks || ''
                        }));
                    }
                } catch (e) {
                    console.log('Workflow content fallback to standard project parties endpoint', e);
                }
            }

            if (serverParties.length === 0) {
                const response = await generalDocsApi.getParties(projectId);
                const rawParties = response.parties || [];
                serverParties = rawParties.map(p => ({
                    id: p.pv_id || p.project_party_id || p.id,
                    party_id: p.party_id || p.id,
                    name: p.name || p.company_name || '',
                    category: resolvePartyCategory(p.category || 'Contractor'),
                    job_name: p.job_nature || p.job_name || '',
                    contact_person: p.contact_person || '',
                    designation: p.designation || '',
                    telephone_no: p.mobile || p.telephone_no || '',
                    email: p.email || '',
                    address: p.address || '',
                    remarks: p.remarks || ''
                }));
            }

            setParties(serverParties);

            setGridData(prevGrid => {
                if (prevGrid.length === 0 || !prevGrid.some(r => r._status === 'modified' || r._status === 'new')) {
                    return serverParties.map(p => ({ ...p, _status: 'saved', _errors: {} }));
                }
                return prevGrid;
            });

            if (isManualRefresh) {
                showToast('success', 'Refreshed', 'Parties list synchronized with server.');
            }
        } catch (error) {
            console.error('Failed to load project parties', error);
            showToast('error', 'Load Failed', 'Could not load project parties from server.');
        } finally {
            setIsLoading(false);
        }
    }, [projectId, workflowState.instanceId, workflowState.cycleId, workflowState.notConfigured]);

    // Initial fetch for CRM contacts
    useEffect(() => {
        fetchAvailableContacts();
    }, [fetchAvailableContacts]);

    // Synchronize parties when workflow state resolves
    useEffect(() => {
        if (workflowState.loading) return;
        fetchParties();
    }, [projectId, workflowState.loading, workflowState.instanceId, workflowState.cycleId, fetchParties]);

    // Save Spreadsheet Rows
    const saveGridRows = async () => {
        setIsSaving(true);
        try {
            const hasErrors = gridData.some(r => !r.name || !r.name.trim());
            if (hasErrors) {
                showToast('error', 'Validation Error', 'All party entries must have a Company Name.');
                setIsSaving(false);
                return;
            }

            const currentPayload = gridData.map(r => ({
                id: String(r.id).startsWith('temp_') ? undefined : r.id,
                party_id: r.party_id,
                name: (r.name || '').trim(),
                category: r.category || 'Contractor',
                job_nature: (r.job_name || '').trim(),
                contact_person: (r.contact_person || '').trim(),
                designation: (r.designation || '').trim(),
                mobile: (r.telephone_no || '').trim(),
                telephone_no: (r.telephone_no || '').trim(),
                email: (r.email || '').trim(),
                address: (r.address || '').trim(),
                remarks: (r.remarks || '').trim()
            }));

            if (workflowState && workflowState.cycleId) {
                await workflowApi.saveDraft(workflowState.cycleId, {
                    pdoc_vendors: currentPayload,
                    pdoc_parties: currentPayload
                });
            } else {
                await generalDocsApi.syncParties(projectId, {
                    parties: currentPayload,
                    deleted_ids: Array.from(deletedIds)
                });
            }

            sessionStorage.removeItem(`mano_project_parties_draft_grid_${projectId}`);
            sessionStorage.removeItem(`mano_project_parties_draft_deleted_${projectId}`);
            setDeletedIds(new Set());
            await fetchParties(false);

            showToast('success', 'Changes Saved', 'Project parties updated successfully.');
        } catch (error) {
            console.error('Save failed:', error);
            showToast('error', 'Save Failed', error.response?.data?.message || 'Could not save project parties.');
        } finally {
            setIsSaving(false);
        }
    };

    // Filter and Sort Grid Data (High-performance fast execution)
    const filteredGridData = useMemo(() => {
        const hasCategory = selectedCategoryFilter !== 'All';
        const hasSearch = Boolean(searchTerm && searchTerm.trim());

        if (!hasCategory && !hasSearch) {
            return gridData;
        }

        const lowerSearch = hasSearch ? searchTerm.toLowerCase().trim() : '';

        return gridData.filter(row => {
            if (hasCategory && row.category !== selectedCategoryFilter) return false;
            if (lowerSearch) {
                const name = row.name ? row.name.toLowerCase() : '';
                const cat = row.category ? row.category.toLowerCase() : '';
                const job = row.job_name ? row.job_name.toLowerCase() : '';
                const contact = row.contact_person ? row.contact_person.toLowerCase() : '';
                const desig = row.designation ? row.designation.toLowerCase() : '';
                const phone = row.telephone_no ? row.telephone_no.toLowerCase() : '';
                const email = row.email ? row.email.toLowerCase() : '';
                const addr = row.address ? row.address.toLowerCase() : '';
                const rem = row.remarks ? row.remarks.toLowerCase() : '';

                return name.includes(lowerSearch) ||
                    cat.includes(lowerSearch) ||
                    job.includes(lowerSearch) ||
                    contact.includes(lowerSearch) ||
                    desig.includes(lowerSearch) ||
                    phone.includes(lowerSearch) ||
                    email.includes(lowerSearch) ||
                    addr.includes(lowerSearch) ||
                    rem.includes(lowerSearch);
            }
            return true;
        });
    }, [gridData, searchTerm, selectedCategoryFilter]);

    const sortedGridData = useMemo(() => {
        if (!sortConfig.key || filteredGridData.length <= 1) return filteredGridData;
        const key = sortConfig.key;
        const isAsc = sortConfig.direction === 'asc';

        return [...filteredGridData].sort((a, b) => {
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
    }, [filteredGridData, sortConfig]);

    const sortedGridDataRef = useRef(sortedGridData);
    sortedGridDataRef.current = sortedGridData;

    const paginatedGridData = useMemo(() => {
        if (pageSize === 'All') return sortedGridData;
        const size = Number(pageSize);
        const start = (currentPage - 1) * size;
        return sortedGridData.slice(start, start + size);
    }, [sortedGridData, currentPage, pageSize]);

    const totalPages = pageSize === 'All' ? 1 : Math.ceil(sortedGridData.length / Number(pageSize)) || 1;

    // Sorting Handler
    const handleSort = (colKey) => {
        setSortConfig(prev => ({
            key: colKey,
            direction: prev.key === colKey && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Cell Edit & Update
    const handleCellChange = (rowIndex, colName, value, isAtomic = false) => {
        if (isAtomic) {
            pushUndoState(gridDataRef.current);
        } else if (!cellEditInitialStateRef.current) {
            cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
        }

        setGridData(prev => {
            const updated = [...prev];
            const targetId = sortedGridDataRef.current[rowIndex]?.id;
            const realIdx = updated.findIndex(r => r.id === targetId);
            if (realIdx === -1) return prev;

            const row = { ...updated[realIdx] };
            row[colName] = value;

            const errors = { ...(row._errors || {}) };
            if (colName === 'name') {
                if (!value || !value.trim()) errors.name = 'Company Name is required';
                else delete errors.name;
            }
            row._errors = errors;

            const original = originalPartiesMap.get(row.id);
            if (Object.keys(errors).length === 0) {
                delete row._errors;
                if (!original || row._status === 'new') {
                    row._status = 'new';
                } else {
                    const isDirty = isPartyRowDirty(row, original);
                    row._status = isDirty ? 'modified' : 'saved';
                }
            } else {
                row._status = 'error';
            }

            updated[realIdx] = row;
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

    // Row selection toggle
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

    const handleSelectAll = (e) => {
        e?.stopPropagation();
        if (selectedIds.size === sortedGridData.length) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(sortedGridData.map(r => r.id));
            setSelectedIds(allIds);
        }
    };

    // Delete row entries
    const handleDeleteRows = (rowsToDelete) => {
        if (!rowsToDelete || rowsToDelete.length === 0) return;
        pushUndoState(gridDataRef.current);

        const rowIds = new Set(rowsToDelete.map(r => r.id));
        const savedIds = rowsToDelete.filter(r => !String(r.id).startsWith('temp_')).map(r => r.id);

        setGridData(prev => prev.filter(r => !rowIds.has(r.id)));
        setSelectedIds(prev => {
            const next = new Set(prev);
            rowIds.forEach(id => next.delete(id));
            return next;
        });
        setSelectionAnchor(null);
        setSelectionFocus(null);
        showToast('success', 'Entry Deleted', `Removed ${rowsToDelete.length} party row(s) locally. Click "Save Changes" to apply.`);

        if (savedIds.length > 0) {
            setDeletedIds(prev => new Set([...prev, ...savedIds]));
        }
    };

    // Category-Aware Add Rows Helper
    const handleAddPartyByCategory = (category = null, count = 1) => {
        pushUndoState(gridDataRef.current);
        const { gridInsertIdx, sortedRowIdx } = getTargetInsertIndex();
        const targetCategory = category || (selectedCategoryFilter !== 'All' ? selectedCategoryFilter : 'Contractor');
        
        const newRows = Array.from({ length: count }).map((_, idx) => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${idx}`,
            name: '',
            category: targetCategory,
            job_name: '',
            contact_person: '',
            designation: '',
            telephone_no: '',
            email: '',
            address: '',
            remarks: '',
            _status: 'new',
            _errors: {}
        }));

        setGridData(prev => {
            const next = [...prev];
            next.splice(gridInsertIdx, 0, ...newRows);
            return next;
        });

        setIsAddMenuOpen(false);
        const targetPage = pageSize !== 'All' ? Math.floor(sortedRowIdx / Number(pageSize)) + 1 : 1;
        if (pageSize !== 'All' && targetPage !== currentPage) {
            setCurrentPage(targetPage);
        }

        setSelectionAnchor({ r: sortedRowIdx, c: 0 });
        setSelectionFocus({ r: sortedRowIdx + count - 1, c: 0 });
        showToast('sparkle', `${targetCategory} Added`, `Added ${count} new ${targetCategory} row(s).`);
    };

    // Insert Row Above / Below
    const handleInsertRow = (targetRowIdx, position = 'below') => {
        pushUndoState(gridDataRef.current);
        const targetRow = sortedGridDataRef.current[targetRowIdx];
        let realIdx = targetRowIdx;
        if (targetRow) {
            const found = gridDataRef.current.findIndex(r => r.id === targetRow.id);
            if (found !== -1) realIdx = found;
        }
        const insertIdx = position === 'above' ? realIdx : realIdx + 1;
        const targetCategory = targetRow?.category || (selectedCategoryFilter !== 'All' ? selectedCategoryFilter : 'Contractor');

        const newRow = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: '',
            category: targetCategory,
            job_name: '',
            contact_person: '',
            designation: '',
            telephone_no: '',
            email: '',
            address: '',
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
        showToast('info', 'Row Inserted', `Inserted new row ${position} row #${targetRowIdx + 1}.`);
    };

    // Duplicate Row
    const handleDuplicateRow = (targetRow) => {
        if (!targetRow) return;
        pushUndoState(gridDataRef.current);

        const duplicate = {
            ...targetRow,
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${Math.floor(Math.random() * 1000)}`,
            name: targetRow.name ? `${targetRow.name} (Copy)` : 'New Copy',
            _status: 'new',
            _errors: {}
        };

        let realIdx = gridDataRef.current.length;
        let sortedIdx = sortedGridDataRef.current.length;
        if (targetRow && targetRow.id) {
            const foundIdx = gridDataRef.current.findIndex(r => r.id === targetRow.id);
            if (foundIdx !== -1) realIdx = foundIdx + 1;
            const foundSortedIdx = sortedGridDataRef.current.findIndex(r => r.id === targetRow.id);
            if (foundSortedIdx !== -1) sortedIdx = foundSortedIdx + 1;
        }

        setGridData(prev => {
            const next = [...prev];
            next.splice(realIdx, 0, duplicate);
            return next;
        });

        setSelectionAnchor({ r: sortedIdx, c: 0 });
        setSelectionFocus({ r: sortedIdx, c: 0 });
        showToast('sparkle', 'Row Duplicated', `Duplicated "${targetRow.name || 'party'}" right below.`);
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
                        handleDeleteRows(rowsToDelete);
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
                if (colName !== 'category') {
                    cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                    setEditingCell({ rowIndex: curFocus.r, colName });
                }
            }
            return;
        }

        // Direct typing replaces cell content
        if (canWrite && e.key.length === 1 && !isModifier && !e.altKey) {
            if (colName !== 'category') {
                cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                setEditingCell({ rowIndex: curFocus.r, colName });
                handleCellChange(curFocus.r, colName, e.key);
            }
        }
    };

    // Fill Down (Ctrl+D)
    const handleFillDown = () => {
        const b = getBoundsFromRefs();
        if (!b || !canWrite) return;

        if (b.minRow === b.maxRow) {
            // Single row / cell selection: copy from row above
            if (b.minRow > 0) {
                pushUndoState(gridDataRef.current);
                let updatedGrid = [...gridDataRef.current];
                let numCellsFilled = 0;
                const sourceRowObj = sortedGridDataRef.current[b.minRow - 1];
                const targetRowObj = sortedGridDataRef.current[b.minRow];
                if (sourceRowObj && targetRowObj) {
                    const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
                    if (realIdx !== -1) {
                        const rowCopy = { ...updatedGrid[realIdx] };
                        for (let c = b.minCol; c <= b.maxCol; c++) {
                            const colName = GRID_COLUMNS[c];
                            rowCopy[colName] = sourceRowObj[colName] ?? '';
                            numCellsFilled++;
                        }
                        if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                        updatedGrid[realIdx] = rowCopy;
                    }
                }
                if (numCellsFilled > 0) {
                    setGridData(updatedGrid);
                    showToast('sparkle', 'Filled Down (Ctrl+D)', `Duplicated value from row above across ${numCellsFilled} cell(s). Click "Save Changes" to apply.`);
                }
            } else {
                showToast('info', 'Fill Down', 'No row above to copy from.');
            }
            return;
        }

        pushUndoState(gridDataRef.current);
        let updatedGrid = [...gridDataRef.current];

        for (let c = b.minCol; c <= b.maxCol; c++) {
            const colName = GRID_COLUMNS[c];
            const topRowObj = sortedGridDataRef.current[b.minRow];
            if (!topRowObj) continue;
            const topVal = topRowObj[colName];

            for (let r = b.minRow + 1; r <= b.maxRow; r++) {
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
        showToast('sparkle', 'Fill Down (Ctrl+D)', `Filled down values across ${b.maxRow - b.minRow + 1} rows.`);
    };

    // Fill Right (Ctrl+R)
    const handleFillRight = () => {
        const b = getBoundsFromRefs();
        if (!b || b.minCol === b.maxCol || !canWrite) return;
        pushUndoState(gridDataRef.current);

        let updatedGrid = [...gridDataRef.current];

        for (let r = b.minRow; r <= b.maxRow; r++) {
            const targetRowObj = sortedGridDataRef.current[r];
            if (!targetRowObj) continue;
            const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
            if (realIdx === -1) continue;

            const sourceColName = GRID_COLUMNS[b.minCol];
            const fillVal = targetRowObj[sourceColName];

            const rowCopy = { ...updatedGrid[realIdx] };
            for (let c = b.minCol + 1; c <= b.maxCol; c++) {
                const col = GRID_COLUMNS[c];
                rowCopy[col] = fillVal;
            }
            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
            updatedGrid[realIdx] = rowCopy;
        }

        setGridData(updatedGrid);
        showToast('sparkle', 'Fill Right (Ctrl+R)', `Filled right values across columns.`);
    };

    // Auto-Fill Down (Double-Click Fill Handle)
    const handleAutoFillDown = () => {
        const b = getBoundsFromRefs();
        if (!b || !canWrite) return;
        const totalRows = sortedGridDataRef.current.length;
        if (b.maxRow >= totalRows - 1) return;

        pushUndoState(gridDataRef.current);
        let updatedGrid = [...gridDataRef.current];
        const sourceRowObj = sortedGridDataRef.current[b.maxRow];
        if (!sourceRowObj) return;

        for (let r = b.maxRow + 1; r < totalRows; r++) {
            const targetRowObj = sortedGridDataRef.current[r];
            if (!targetRowObj) continue;
            const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
            if (realIdx === -1) continue;

            const rowCopy = { ...updatedGrid[realIdx] };
            for (let c = b.minCol; c <= b.maxCol; c++) {
                const colName = GRID_COLUMNS[c];
                rowCopy[colName] = sourceRowObj[colName] ?? '';
            }
            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
            updatedGrid[realIdx] = rowCopy;
        }

        setGridData(updatedGrid);
        setSelectionFocus({ r: totalRows - 1, c: b.maxCol });
        showToast('sparkle', 'Auto-Fill Down', `Auto-filled values down to bottom of table (${totalRows} rows).`);
    };

    // Copy to Clipboard
    const executeCopy = () => {
        let rowsToCopy = [];
        let minCol = 0;
        let maxCol = GRID_COLUMNS.length - 1;

        const curSelectedIds = selectedIdsRef.current;
        const b = getBoundsFromRefs();

        if (curSelectedIds.size > 0) {
            rowsToCopy = sortedGridDataRef.current.filter(r => curSelectedIds.has(r.id));
        } else if (b) {
            for (let r = b.minRow; r <= b.maxRow; r++) {
                if (sortedGridDataRef.current[r]) rowsToCopy.push(sortedGridDataRef.current[r]);
            }
            minCol = b.minCol;
            maxCol = b.maxCol;
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

    // Cut to Clipboard
    const executeCut = () => {
        if (!canWrite) return;
        executeCopy();
        pushUndoState(gridDataRef.current);
        const curSelectedIds = selectedIdsRef.current;
        const b = getBoundsFromRefs();

        if (curSelectedIds.size > 0) {
            handleBulkDelete();
            return;
        }

        if (!b) return;
        let updatedGrid = [...gridDataRef.current];
        let numCleared = 0;

        for (let r = b.minRow; r <= b.maxRow; r++) {
            const targetRowObj = sortedGridDataRef.current[r];
            if (!targetRowObj) continue;
            const realIdx = updatedGrid.findIndex(row => row.id === targetRowObj.id);
            if (realIdx === -1) continue;

            const rowCopy = { ...updatedGrid[realIdx] };
            for (let c = b.minCol; c <= b.maxCol; c++) {
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

    // Enhanced Smart Paste Matrix Handler with Header Detection & Auto-Mapping
    const executePaste = (pastedText, forcedStartRow, forcedStartCol) => {
        const textToPaste = pastedText || internalClipboardRef.current;
        if (!textToPaste || !textToPaste.trim()) {
            showToast('info', '', 'Clipboard is empty');
            return;
        }

        const parsedRows = parseExcelClipboardText(textToPaste);
        if (parsedRows.length === 0) return;

        pushUndoState(gridDataRef.current);

        let startRow = 0;
        let startCol = 0;

        const curSelectedIds = selectedIdsRef.current;
        const b = getBoundsFromRefs();

        if (forcedStartRow !== undefined && forcedStartCol !== undefined) {
            startRow = forcedStartRow;
            startCol = forcedStartCol;
        } else if (curSelectedIds.size > 0) {
            const firstSelectedId = Array.from(curSelectedIds)[0];
            const foundIdx = sortedGridDataRef.current.findIndex(r => r.id === firstSelectedId);
            if (foundIdx !== -1) startRow = foundIdx;
            startCol = b ? b.minCol : 0;
        } else if (b) {
            startRow = b.minRow;
            startCol = b.minCol;
        } else if (selectionAnchorRef.current) {
            startRow = selectionAnchorRef.current.r;
            startCol = selectionAnchorRef.current.c;
        } else {
            // Default if nothing selected: start at beginning or append
            startRow = 0;
            startCol = 0;
        }

        // Smart Header Detection in Pasted Text
        let hasHeaderRow = false;
        const headerColMap = {};
        if (parsedRows.length > 0) {
            const row0 = parsedRows[0];
            let matchCount = 0;
            row0.forEach((cell, idx) => {
                const matched = matchColumnHeader(String(cell || ''));
                if (matched) {
                    headerColMap[idx] = matched;
                    matchCount++;
                }
            });
            if (matchCount >= 2 || (row0.length === 1 && matchColumnHeader(String(row0[0] || '')))) {
                hasHeaderRow = true;
            }
        }

        const effectiveRows = hasHeaderRow ? parsedRows.slice(1) : parsedRows;
        if (effectiveRows.length === 0) {
            showToast('info', 'Header Row Pasted', 'Only column header row was found in clipboard. No data rows to paste.');
            return;
        }

        // Smart Range Replication
        let expandedRows = effectiveRows;
        if (b && (b.maxRow > b.minRow || b.maxCol > b.minCol) && forcedStartRow === undefined && !hasHeaderRow) {
            const targetRowCount = b.maxRow - b.minRow + 1;
            const targetColCount = b.maxCol - b.minCol + 1;

            if (effectiveRows.length === 1 && effectiveRows[0].length === 1) {
                const singleVal = effectiveRows[0][0];
                expandedRows = Array.from({ length: targetRowCount }, () =>
                    Array.from({ length: targetColCount }, () => singleVal)
                );
            } else if (effectiveRows.length === 1 && targetRowCount > 1) {
                expandedRows = Array.from({ length: targetRowCount }, () => [...effectiveRows[0]]);
            } else if (effectiveRows[0].length === 1 && targetColCount > 1) {
                expandedRows = effectiveRows.map(row => Array.from({ length: targetColCount }, () => row[0]));
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
                        const targetColName = hasHeaderRow && headerColMap[dc]
                            ? headerColMap[dc]
                            : GRID_COLUMNS[startCol + dc];

                        if (targetColName && GRID_COLUMNS.includes(targetColName)) {
                            let valToAssign = (cellVal ?? '').trim();
                            if (targetColName === 'category') {
                                valToAssign = resolvePartyCategory(valToAssign);
                            }
                            rowCopy[targetColName] = valToAssign;
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
                    category: selectedCategoryFilter !== 'All' ? selectedCategoryFilter : 'Contractor',
                    job_name: '',
                    contact_person: '',
                    designation: '',
                    telephone_no: '',
                    email: '',
                    address: '',
                    remarks: '',
                    _status: 'new',
                    _errors: {}
                };
                cells.forEach((cellVal, dc) => {
                    const targetColName = hasHeaderRow && headerColMap[dc]
                        ? headerColMap[dc]
                        : GRID_COLUMNS[startCol + dc];

                    if (targetColName && GRID_COLUMNS.includes(targetColName)) {
                        let valToAssign = (cellVal ?? '').trim();
                        if (targetColName === 'category') {
                            valToAssign = resolvePartyCategory(valToAssign);
                        }
                        newRow[targetColName] = valToAssign;
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
                showToast('sparkle', 'Pasted Successfully', `Pasted ${numCellsUpdated} cell(s) into ${newRowsAddedCount} new party row(s).`);
            } else {
                showToast('sparkle', 'Pasted Successfully', numCellsUpdated === 1 ? 'Pasted 1 cell successfully' : `Pasted ${numCellsUpdated} cells successfully.`);
            }
        }
    };
    executePasteRef.current = executePaste;

    // Helper to parse 2D array or array of objects into structured party objects
    const parseRawRowsToParties = (rawRows, defaultCategory = 'Contractor') => {
        if (!rawRows || rawRows.length === 0) return [];
        const parsedList = [];

        if (Array.isArray(rawRows[0])) {
            // 2D Array
            let headerRowIdx = -1;
            let colMap = {};

            // Inspect top 10 rows for matching column headers
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
                    category: defaultCategory !== 'All' ? defaultCategory : 'Contractor',
                    job_name: '',
                    contact_person: '',
                    designation: '',
                    telephone_no: '',
                    email: '',
                    address: '',
                    remarks: '',
                    _status: 'new',
                    _errors: {}
                };

                row.forEach((cellVal, cIdx) => {
                    const val = String(cellVal ?? '').trim();
                    const targetCol = headerRowIdx !== -1 ? colMap[cIdx] : GRID_COLUMNS[cIdx];
                    if (targetCol && GRID_COLUMNS.includes(targetCol)) {
                        if (targetCol === 'category') {
                            item.category = resolvePartyCategory(val);
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
            // Array of Objects
            rawRows.forEach((r, rIdx) => {
                const item = {
                    id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${rIdx}`,
                    name: '',
                    category: defaultCategory !== 'All' ? defaultCategory : 'Contractor',
                    job_name: '',
                    contact_person: '',
                    designation: '',
                    telephone_no: '',
                    email: '',
                    address: '',
                    remarks: '',
                    _status: 'new',
                    _errors: {}
                };

                Object.entries(r).forEach(([key, val]) => {
                    const cleanVal = String(val ?? '').trim();
                    const targetCol = matchColumnHeader(key) || (GRID_COLUMNS.includes(key) ? key : null);
                    if (targetCol && GRID_COLUMNS.includes(targetCol)) {
                        if (targetCol === 'category') {
                            item.category = resolvePartyCategory(cleanVal);
                        } else {
                            item[targetCol] = cleanVal;
                        }
                    }
                });

                if (!item.name) {
                    const fallbackName = r['Company Name'] || r['Company'] || r['name'] || r['Name'] || r['Party Name'] || '';
                    if (fallbackName) item.name = String(fallbackName).trim();
                }

                if (item.name) {
                    parsedList.push(item);
                }
            });
        }

        return parsedList;
    };

    // File Upload Handler for Excel (.xlsx, .xls) and CSV (.csv)
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        const isCsv = file.name.endsWith('.csv');

        reader.onload = (evt) => {
            try {
                let rawAoa = [];
                if (isCsv) {
                    const text = evt.target.result;
                    const parsed = Papa.parse(text, { skipEmptyLines: true });
                    rawAoa = parsed.data || [];
                } else {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[firstSheetName];
                    rawAoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                }

                const parsedParties = parseRawRowsToParties(rawAoa, selectedCategoryFilter);
                if (parsedParties.length === 0) {
                    showToast('error', 'Import Failed', 'Could not find valid company records in this file. Please check file format.');
                    return;
                }

                setExcelParsedParties(parsedParties);
                setExcelSourceFileName(file.name);
                setExcelModalTab('upload');
                setIsExcelModalOpen(true);
                showToast('sparkle', 'Spreadsheet Loaded', `Loaded ${parsedParties.length} party row(s) from "${file.name}". Review the preview in the right sidebar.`);
            } catch (err) {
                console.error('Error processing spreadsheet file:', err);
                showToast('error', 'Import Error', 'Failed to read spreadsheet file. Please verify file format.');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        if (isCsv) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    };

    // Helper to copy dummy data to clipboard
    const handleCopyDummyData = () => {
        const headers = [
            'Company Name',
            'Category',
            'Nature of Job',
            'Contact Person',
            'Designation',
            'Contact No',
            'Email ID',
            'Address',
            'Remarks'
        ];

        const rows = DUMMY_PROJECT_PARTIES.map(p => [
            p.name,
            p.category,
            p.job_name,
            p.contact_person,
            p.designation,
            p.telephone_no,
            p.email,
            p.address,
            p.remarks
        ]);

        const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(tsv).then(() => {
                showToast('sparkle', 'Dummy Data Copied!', 'Copied 10 sample project parties to clipboard. Click anywhere on the table and press Ctrl+V to test instant Excel pasting!');
            }).catch(() => {
                internalClipboardRef.current = tsv;
                showToast('info', 'Ready to Paste', 'Data copied internally. Press Ctrl+V on table to paste.');
            });
        } else {
            internalClipboardRef.current = tsv;
            showToast('info', 'Ready to Paste', 'Data copied internally. Press Ctrl+V on table to paste.');
        }
        setIsExcelDropdownOpen(false);
    };

    // Helper to directly load dummy data into the grid
    const handleLoadDummyParties = (isAppend = true) => {
        pushUndoState(gridDataRef.current);
        const newRows = DUMMY_PROJECT_PARTIES.map((p, idx) => ({
            id: `temp_dummy_${Date.now()}_${idx}`,
            name: p.name,
            category: p.category,
            job_name: p.job_name,
            contact_person: p.contact_person,
            designation: p.designation,
            telephone_no: p.telephone_no,
            email: p.email,
            address: p.address,
            remarks: p.remarks,
            _status: 'new',
            _errors: {}
        }));

        if (isAppend) {
            setGridData(prev => [...newRows, ...prev]);
        } else {
            setGridData(newRows);
        }
        setIsExcelModalOpen(false);
        setIsExcelDropdownOpen(false);
        showToast('sparkle', 'Dummy Data Loaded!', `Loaded ${newRows.length} sample project parties into the sheet.`);
    };

    // Global keyboard shortcuts
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
                setContextMenu(null);
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifier = isMac ? e.metaKey : e.ctrlKey;

            // Delete or Backspace key
            if (!isEditingText && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (canWrite) {
                    const curSelectedIds = selectedIdsRef.current;
                    const b = getBoundsFromRefs();
                    if (curSelectedIds.size > 0) {
                        e.preventDefault();
                        handleBulkDelete();
                        return;
                    } else if (b) {
                        e.preventDefault();
                        const totalCols = GRID_COLUMNS.length;
                        const isFullRowSelected = (b.minCol === 0 && b.maxCol === totalCols - 1);
                        if (isFullRowSelected) {
                            const rowsToDelete = [];
                            for (let r = b.minRow; r <= b.maxRow; r++) {
                                const targetRowObj = sortedGridDataRef.current[r];
                                if (targetRowObj) rowsToDelete.push(targetRowObj);
                            }
                            if (rowsToDelete.length > 0) {
                                pushUndoState(gridDataRef.current);
                                const idsToRemove = new Set(rowsToDelete.map(r => r.id));
                                setGridData(prev => prev.filter(r => !idsToRemove.has(r.id)));
                                const savedIds = rowsToDelete.map(r => r.id).filter(id => !String(id).startsWith('temp_'));
                                if (savedIds.length > 0) {
                                    setDeletedIds(prev => new Set([...prev, ...savedIds]));
                                }
                                setSelectionAnchor(null);
                                setSelectionFocus(null);
                                showToast('sparkle', '', `Deleted ${rowsToDelete.length} row(s)`);
                                return;
                            }
                        } else {
                            handleClearSelectedCells();
                            return;
                        }
                    }
                }
            }

            // Ctrl+C / Cmd+C : Copy
            if (modifier && (e.key === 'c' || e.key === 'C')) {
                if (isEditingText && activeEl?.selectionStart !== activeEl?.selectionEnd) {
                    return;
                }
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

            // Ctrl+V / Cmd+V : Paste
            if (modifier && (e.key === 'v' || e.key === 'V')) {
                if (!isEditingText && canWrite) {
                    const hasSel = selectedIdsRef.current.size > 0 || selectionAnchorRef.current !== null;
                    if (hasSel) {
                        return; // Let native paste event fire
                    }
                }
            }

            // Ctrl+D / Cmd+D : Duplicate / Fill Down
            if (modifier && (e.key === 'd' || e.key === 'D')) {
                if (canWrite) {
                    e.preventDefault();
                    handleFillDown();
                    return;
                }
            }

            // Ctrl+R / Cmd+R : Fill Right
            if (modifier && (e.key === 'r' || e.key === 'R')) {
                if (canWrite) {
                    e.preventDefault();
                    handleFillRight();
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

            // Ctrl+S : Save
            if (modifier && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                saveGridRows();
                return;
            }

            // Ctrl+Z / Cmd+Z : Undo
            if (modifier && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                if (!isEditingText) {
                    e.preventDefault();
                    handleUndo();
                    return;
                }
            }

            // Ctrl+Y / Cmd+Y or Ctrl+Shift+Z : Redo
            if (modifier && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
                if (!isEditingText) {
                    e.preventDefault();
                    handleRedo();
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleGlobalShortcuts);
        return () => window.removeEventListener('keydown', handleGlobalShortcuts);
    }, [canWrite]);

    // Native Browser Copy/Paste event handlers
    useEffect(() => {
        const handleNativeCopy = (e) => {
            const activeEl = document.activeElement;
            const activeTag = activeEl?.tagName?.toLowerCase();
            if ((activeTag === 'input' || activeTag === 'textarea') && activeEl.selectionStart !== activeEl.selectionEnd) {
                return;
            }
            const curSelectedIds = selectedIdsRef.current;
            const anchor = selectionAnchorRef.current;
            if (curSelectedIds.size === 0 && !anchor) return;

            const b = getBoundsFromRefs();
            let rowsToCopy = [];
            let minCol = 0;
            let maxCol = GRID_COLUMNS.length - 1;

            if (curSelectedIds.size > 0) {
                rowsToCopy = sortedGridDataRef.current.filter(r => curSelectedIds.has(r.id));
            } else if (b) {
                for (let r = b.minRow; r <= b.maxRow; r++) {
                    if (sortedGridDataRef.current[r]) rowsToCopy.push(sortedGridDataRef.current[r]);
                }
                minCol = b.minCol;
                maxCol = b.maxCol;
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

            const isMultiCell = pastedData.includes('\t') || pastedData.includes('\n') || pastedData.includes('\r');
            if (isInInput && !isMultiCell) return;

            if (!selectionAnchorRef.current && selectedIdsRef.current.size === 0) return;

            e.preventDefault();
            executePasteRef.current(pastedData);
        };

        window.addEventListener('copy', handleNativeCopy);
        window.addEventListener('paste', handleNativePaste);
        return () => {
            window.removeEventListener('copy', handleNativeCopy);
            window.removeEventListener('paste', handleNativePaste);
        };
    }, []);

    // Right Click Context Menu Handler
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

    // Add Multiple Selected CRM Contacts by Category
    const handleImportSelectedCrmContacts = () => {
        if (crmSelectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);

        const contactsToAdd = allAvailableCrmContacts.filter(c => crmSelectedIds.has(c.id));
        const newRows = contactsToAdd.map(c => ({
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            party_id: c.contact_id || c.id,
            name: c.name,
            category: c.category || (crmPickerCategory !== 'All' ? crmPickerCategory : 'Contractor'),
            job_name: c.job_name || '',
            contact_person: c.contact_person || '',
            designation: c.designation || '',
            telephone_no: c.telephone_no || '',
            email: c.email || '',
            address: c.address || '',
            remarks: c.remarks || '',
            _status: 'new',
            _errors: {}
        }));

        setGridData(prev => [...newRows, ...prev]);
        setCrmSelectedIds(new Set());
        setIsCrmPickerOpen(false);
        showToast('sparkle', 'Contacts Added', `Added ${newRows.length} party contact(s) to project.`);
    };

    // Duplicate Resolver Integration
    const handleConfirmDeleteDuplicates = (idsToDelete) => {
        if (!idsToDelete || idsToDelete.size === 0) return;
        pushUndoState(gridDataRef.current);

        const idsSet = new Set(idsToDelete);
        const updatedGrid = gridDataRef.current.filter(r => !idsSet.has(r.id));
        const savedIds = Array.from(idsSet).filter(id => !String(id).startsWith('temp_'));

        if (savedIds.length > 0) {
            setDeletedIds(prev => new Set([...prev, ...savedIds]));
        }

        setGridData(updatedGrid);
        setIsDuplicateModalOpen(false);
        showToast('success', 'Duplicates Resolved', `Removed ${idsToDelete.size} duplicate party row(s).`);
    };

    // Bulk Floating Bar Actions
    const handleBulkCategoryChange = (category) => {
        if (selectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);
        setGridData(prev => {
            return prev.map(r => {
                if (selectedIds.has(r.id)) {
                    return {
                        ...r,
                        category,
                        _status: r._status === 'new' ? 'new' : 'modified'
                    };
                }
                return r;
            });
        });
        setShowBulkCategoryMenu(false);
        showToast('sparkle', 'Category Updated', `Updated ${selectedIds.size} party entry(ies) to ${category}.`);
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        setConfirmModal({
            isOpen: true,
            title: 'Delete Selected Parties?',
            message: `Are you sure you want to delete ${selectedIds.size} selected party entry(ies)? Click "Save Changes" after deletion to apply to cloud.`,
            confirmText: `Delete (${selectedIds.size})`,
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: () => {
                pushUndoState(gridDataRef.current);
                const idsToDelete = Array.from(selectedIds);
                const savedIds = idsToDelete.filter(id => !String(id).startsWith('temp_'));
                const count = selectedIds.size;

                setParties(prev => prev.filter(r => !selectedIds.has(r.id)));
                setGridData(prev => prev.filter(r => !selectedIds.has(r.id)));
                setSelectedIds(new Set());
                closeConfirmModal();
                showToast('success', 'Bulk Delete Successful', `Deleted ${count} selected party entry(ies) locally. Click "Save Changes" to apply.`);

                if (savedIds.length > 0) {
                    setDeletedIds(prev => new Set([...prev, ...savedIds]));
                }
            }
        });
    };

    const handleBulkCopy = () => {
        if (selectedIds.size === 0) return;
        const selectedRows = sortedGridData.filter(r => selectedIds.has(r.id));
        const lines = selectedRows.map(r => GRID_COLUMNS.map(col => r[col] || '').join('\t'));
        const text = lines.join('\n');
        internalClipboardRef.current = text;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
        }
        showToast('sparkle', '', `Copied ${selectedRows.length} row${selectedRows.length > 1 ? 's' : ''} to clipboard`);
    };

    const handleBulkClear = () => {
        if (selectedIds.size === 0) return;
        pushUndoState(gridDataRef.current);
        setGridData(prev => prev.map(r => {
            if (selectedIds.has(r.id)) {
                return {
                    ...r,
                    name: '',
                    job_name: '',
                    contact_person: '',
                    designation: '',
                    telephone_no: '',
                    email: '',
                    address: '',
                    remarks: '',
                    _status: r._status === 'new' ? 'new' : 'modified'
                };
            }
            return r;
        }));
        showToast('info', 'Cleared', `Cleared contents of ${selectedIds.size} selected row(s).`);
    };

    // Export to CSV
    const handleExportCSV = () => {
        const headers = GRID_COLUMNS.map(c => COLUMN_LABELS[c]);
        const rows = sortedGridData.map(r => GRID_COLUMNS.map(col => `"${(r[col] || '').replace(/"/g, '""')}"`).join(','));
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Project_Parties_Project_${projectId}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('success', 'Exported', 'Project parties exported to CSV.');
    };

    // Filtered available CRM contacts for modal picker
    const filteredAvailableCrmContacts = useMemo(() => {
        return allAvailableCrmContacts.filter(c => {
            const matchesCat = crmPickerCategory === 'All' || c.category === crmPickerCategory;
            if (!matchesCat) return false;
            if (!crmPickerSearch) return true;
            const term = crmPickerSearch.toLowerCase();
            return (
                (c.name && c.name.toLowerCase().includes(term)) ||
                (c.category && c.category.toLowerCase().includes(term)) ||
                (c.job_name && c.job_name.toLowerCase().includes(term)) ||
                (c.contact_person && c.contact_person.toLowerCase().includes(term)) ||
                (c.telephone_no && c.telephone_no.toLowerCase().includes(term)) ||
                (c.email && c.email.toLowerCase().includes(term))
            );
        });
    }, [allAvailableCrmContacts, crmPickerCategory, crmPickerSearch]);

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left relative">

            {/* Header & Top Navigation */}
            <div className="px-8 py-3.5 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#0d1117] flex items-center justify-between z-20">
                <div className="flex items-center space-x-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Project Parties</h1>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                {sortedGridData.length} {sortedGridData.length === 1 ? 'Party' : 'Parties'}
                            </span>
                            {hasUnsavedChanges && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                                    <AlertCircle size={10} /> Unsaved Changes ({unsavedCount})
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Interactive spreadsheet directory of clients, PMCs, contractors, suppliers, and consultants linked to this project.
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-2.5 flex-wrap">
                    {/* Category Filter Tab Bar (Segmented pill bar matching other pages, to the left of the refresh/action buttons) */}
                    <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 shrink-0 select-none">
                        {['All', ...CATEGORY_OPTIONS].map(cat => {
                            const isSelected = selectedCategoryFilter === cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategoryFilter(cat);
                                        setCurrentPage(1);
                                    }}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer ${
                                        isSelected
                                            ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>

                    {/* Workflow Approval Action Controls & Version History */}
                    {/* <WorkflowPanel
                        projectId={projectId}
                        templateName="Project Parties"
                        onStateChange={handleWorkflowStateChange}
                        onRefreshContent={() => fetchParties(true)}
                        onActionComplete={() => fetchParties(true)}
                    /> */}

                    {canWrite && (
                        <button
                            onClick={saveGridRows}
                            disabled={!hasUnsavedChanges || isSaving}
                            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                hasUnsavedChanges
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-95 animate-in fade-in'
                                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-60'
                            }`}
                        >
                            {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                    )}

                    <button
                        onClick={() => {
                            fetchParties(true);
                            fetchAvailableContacts(true);
                        }}
                        className="p-2 border border-gray-200 dark:border-white/10 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition active:scale-95 cursor-pointer"
                        title="Refresh parties and CRM data"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Toolbar: Search + Action Tools */}
            <div className="px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0d1117] z-10 border-b border-gray-100 dark:border-white/5">
                {/* Left: Search Bar */}
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-64 shrink-0">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search parties by name, job, contact..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-9 pr-7 py-1.5 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 dark:text-white transition-all font-medium"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Action Tools */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Undo / Redo */}
                    <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden bg-gray-50 dark:bg-white/5">
                        <button
                            onClick={handleUndo}
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition cursor-pointer"
                            title="Undo last edit (Ctrl+Z)"
                        >
                            <RotateCcw size={13} />
                        </button>
                    </div>

                    {/* Duplicate Resolver */}
                    {canWrite && (
                        <button
                            type="button"
                            onClick={() => setIsDuplicateModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                            title="Scan & resolve duplicate parties"
                        >
                            <Layers size={13} />
                            <span>Resolve Duplicates</span>
                        </button>
                    )}

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
                                            downloadExcelTemplateFile(false);
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
                        type="button"
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-200 transition cursor-pointer whitespace-nowrap"
                        title="Export parties spreadsheet to CSV"
                    >
                        <Download size={13} />
                        <span>Export</span>
                    </button>

                    {/* Pick from CRM Master */}
                    {canWrite && (
                        <button
                            type="button"
                            onClick={() => {
                                setCrmPickerCategory(selectedCategoryFilter !== 'All' ? selectedCategoryFilter : 'All');
                                setCrmSelectedIds(new Set());
                                setIsCrmPickerOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                        >
                            <Building2 size={13} />
                            <span>Pick from CRM</span>
                        </button>
                    )}

                    {/* Categorized Add Row Dropdown */}
                    {canWrite && (
                        <div className="relative inline-block" ref={addMenuRef}>
                            <button
                                type="button"
                                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
                            >
                                <Plus size={14} />
                                <span>Add Party</span>
                                <ChevronDown size={12} className={`transition-transform ${isAddMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isAddMenuOpen && (
                                <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[7000] py-1.5 text-xs text-gray-700 dark:text-gray-300 font-semibold overflow-hidden animate-in fade-in zoom-in-95 duration-100 select-none flex flex-col">
                                    <div className="px-3 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-white/5">
                                        Add Party by Role
                                    </div>
                                    {CATEGORY_OPTIONS.map(cat => {
                                        const dotColor = CATEGORY_DOT_COLORS[cat] || CATEGORY_DOT_COLORS.Other;
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => handleAddPartyByCategory(cat, 1)}
                                                className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center justify-between transition-colors cursor-pointer"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                                    <span>+ Add {cat}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                    <div className="border-t border-gray-100 dark:border-white/5 mt-1 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => handleAddPartyByCategory(null, 5)}
                                            className="w-full text-left px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/5 text-[11px] font-bold cursor-pointer"
                                        >
                                            + Add 5 Blank Rows
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Multi-Row Action Dock */}
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="fixed bottom-14 left-1/2 -translate-x-1/2 bg-gray-900/95 dark:bg-[#161b22]/95 text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 z-50 backdrop-blur-md"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold">
                            <CheckSquare size={14} className="text-blue-400" />
                            <span>{selectedIds.size} Selected</span>
                        </div>

                        <div className="h-4 w-px bg-white/20" />

                        {canWrite && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkCategoryMenu(!showBulkCategoryMenu)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition cursor-pointer"
                                >
                                    <Tag size={12} />
                                    <span>Change Category</span>
                                    <ChevronDown size={12} className={`transition-transform ${showBulkCategoryMenu ? 'rotate-180' : ''}`} />
                                </button>

                                {showBulkCategoryMenu && (
                                    <div className="absolute bottom-full mb-2 left-0 w-44 bg-white dark:bg-[#161b22] text-gray-800 dark:text-gray-200 rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 py-1 text-xs font-semibold z-50 overflow-hidden">
                                        {CATEGORY_OPTIONS.map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => handleBulkCategoryChange(cat)}
                                                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                                            >
                                                <span className={`w-2 h-2 rounded-full ${CATEGORY_DOT_COLORS[cat] || 'bg-gray-400'}`} />
                                                <span>{cat}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleBulkCopy}
                            className="flex items-center gap-1 px-2.5 py-1 hover:bg-white/10 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                            <Copy size={12} />
                            <span>Copy</span>
                        </button>

                        {canWrite && (
                            <button
                                type="button"
                                onClick={handleBulkClear}
                                className="flex items-center gap-1 px-2.5 py-1 hover:bg-white/10 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                                <Sparkles size={12} />
                                <span>Clear</span>
                            </button>
                        )}

                        {canWrite && (
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                className="flex items-center gap-1 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                                <Trash2 size={12} />
                                <span>Delete ({selectedIds.size})</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setSelectedIds(new Set())}
                            className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition cursor-pointer ml-1"
                            title="Deselect all"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Layout */}
            <div ref={tableContainerRef} className="flex-1 min-h-0 flex overflow-hidden w-full relative">
                {/* Spreadsheet Grid Table */}
                <div className="flex-1 min-h-0 overflow-auto table-scrollbar">
                    <table className="w-full min-w-[1500px] table-fixed text-left whitespace-nowrap text-sm border-collapse bg-white dark:bg-[#0d1117] select-none">
                        <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-20 border-b border-gray-200 dark:border-white/5 tracking-wider text-[10px] uppercase font-bold select-none shadow-xs">
                            <tr>
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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {isLoading && parties.length === 0 ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`skel-row-${i}`} className="animate-pulse">
                                        {Array.from({ length: GRID_COLUMNS.length + 2 }).map((_, j) => (
                                            <td key={`skel-cell-${i}-${j}`} className="px-3 py-3.5 border border-gray-100 dark:border-white/5">
                                                <div className="h-3 bg-gray-100 dark:bg-white/5 rounded"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : sortedGridData.length === 0 ? (
                                <tr>
                                    <td colSpan={GRID_COLUMNS.length + 2} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3.5 max-w-md mx-auto">
                                            <div className="p-3.5 bg-blue-50 dark:bg-white/5 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-white/10">
                                                <Building2 size={36} />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">No project parties added yet</p>
                                                <p className="text-xs text-gray-400">
                                                    {searchTerm || selectedCategoryFilter !== 'All' 
                                                        ? 'No parties match your current search or category filter.' 
                                                        : 'Import an Excel spreadsheet, paste copied cells from Excel, or click below to start.'}
                                                </p>
                                            </div>
                                            {canWrite && (
                                                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddPartyByCategory(selectedCategoryFilter !== 'All' ? selectedCategoryFilter : 'Contractor', 1)}
                                                        className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition cursor-pointer shadow-xs"
                                                    >
                                                        + Add First Party
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
                                paginatedGridData.map((party, index) => {
                                    const rowIndex = pageSize === 'All' ? index : (currentPage - 1) * Number(pageSize) + index;
                                    const originalParty = originalPartiesMap.get(party.id);
                                    const isNew = party._status === 'new' || String(party.id).startsWith('temp_');
                                    const isError = party._status === 'error';
                                    const isDirty = (party._status === 'modified') || (originalParty && isPartyRowDirty(party, originalParty));
                                    const rowErrors = party._errors || {};
                                    const isRowSelected = selectedIds.has(party.id);

                                    return (
                                        <tr
                                            key={party.id || `row-${rowIndex}`}
                                            onContextMenu={(e) => handleContextMenu(e, rowIndex, 0)}
                                            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 42px' }}
                                            className={`hover:bg-blue-50/20 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 ${isRowSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                                                }`}
                                        >
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

                                                const rawValue = party[colName] || '';

                                                return (
                                                    <td
                                                        key={colName}
                                                        id={`cell-${rowIndex}-${colName}`}
                                                        tabIndex={0}
                                                        onMouseDown={(e) => {
                                                            if (e.target.closest('.category-portal-dropdown')) return;
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
                                                        onClick={(e) => {
                                                            if (e.target.closest('.category-portal-dropdown') || e.target.closest('button')) return;
                                                            if (canWrite) {
                                                                if (selectionAnchor?.r !== rowIndex || selectionAnchor?.c !== colIndex) {
                                                                    setSelectionAnchor({ r: rowIndex, c: colIndex });
                                                                    setSelectionFocus({ r: rowIndex, c: colIndex });
                                                                }
                                                                if (colName !== 'category') {
                                                                    cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                                                                    setEditingCell({ rowIndex, colName });
                                                                }
                                                            }
                                                        }}
                                                        onDoubleClick={() => {
                                                            if (canWrite && colName !== 'category') {
                                                                cellEditInitialStateRef.current = gridDataRef.current.map(r => ({ ...r, _errors: r._errors ? { ...r._errors } : {} }));
                                                                setEditingCell({ rowIndex, colName });
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
                                                                className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-600 border border-white dark:border-gray-900 rounded-xs z-30 cursor-crosshair shadow-xs hover:scale-125 transition-transform"
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
                                                        {colName === 'category' ? (
                                                            <InlineCategorySelector
                                                                value={rawValue}
                                                                disabled={!canWrite}
                                                                onChange={(newCat) => handleCellChange(rowIndex, 'category', newCat, true)}
                                                            />
                                                        ) : isEditing ? (
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
                                                        ) : (
                                                            <div className="truncate min-h-[20px] w-full min-w-0 flex items-center font-medium">
                                                                {rawValue || (
                                                                    <span className="text-gray-300 dark:text-gray-600 italic font-normal text-[11px]">
                                                                        —
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Footer */}
            <div className="px-8 py-2.5 bg-gray-50/80 dark:bg-[#0d1117] border-t border-gray-200/80 dark:border-white/5 flex items-center justify-between z-10 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-3">
                    <span>
                        Showing {sortedGridData.length === 0 ? 0 : (currentPage - 1) * (pageSize === 'All' ? sortedGridData.length : Number(pageSize)) + 1} to{' '}
                        {pageSize === 'All' ? sortedGridData.length : Math.min(currentPage * Number(pageSize), sortedGridData.length)} of {sortedGridData.length} entries
                    </span>
                    <CustomPageSizeDropdown
                        pageSize={pageSize}
                        setPageSize={(size) => {
                            setPageSize(size);
                            setCurrentPage(1);
                        }}
                        totalCount={sortedGridData.length}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1 || pageSize === 'All'}
                        className="px-2.5 py-1 rounded border border-gray-200 dark:border-white/10 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                    >
                        Previous
                    </button>
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages || pageSize === 'All'}
                        className="px-2.5 py-1 rounded border border-gray-200 dark:border-white/10 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                    >
                        Next
                    </button>
                </div>
            </div>

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
                            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold cursor-pointer"
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
                        className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold cursor-pointer"
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
                            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold border-b border-gray-100 dark:border-white/5 pb-1.5 mb-1 cursor-pointer"
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
                            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold cursor-pointer"
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
                            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold border-b border-gray-100 dark:border-white/5 pb-1.5 mb-1 cursor-pointer"
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
                                className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold cursor-pointer"
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
                                className="w-full text-left px-3.5 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200 flex items-center justify-between font-semibold border-b border-gray-100 dark:border-white/5 pb-1.5 mb-1 cursor-pointer"
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
                                className="w-full text-left px-3.5 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300 flex items-center justify-between font-semibold cursor-pointer"
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
                                        if (targetRow) handleDeleteRows([targetRow]);
                                    }
                                }}
                                className="w-full text-left px-3.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-between font-semibold cursor-pointer"
                            >
                                <span>Delete {selectedIds.size > 0 ? `Selected (${selectedIds.size})` : 'Row'}</span>
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Duplicate Resolver Modal */}
            <DuplicateResolverModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                title="Remove Duplicate Project Parties"
                gridData={gridData}
                getKey={(row) => {
                    const cleanName = (row.name || '').replace(/\s*\(\s*copy(?:\s+\d+)?\s*\)/gi, '').trim().toLowerCase();
                    const email = (row.email || '').trim().toLowerCase();
                    const phone = (row.telephone_no || '').trim().toLowerCase();
                    return cleanName || email || phone;
                }}
                getLabel={(row) => row.name || 'Unnamed Party'}
                getSubLabel={(row) => [row.category, row.job_name, row.email, row.telephone_no].filter(Boolean).join(' • ')}
                onDeleteDuplicates={handleConfirmDeleteDuplicates}
            />

            {/* CRM Master Picker Right Sidebar Slide-Over Drawer */}
            <AnimatePresence>
                {isCrmPickerOpen && (
                    <div className="fixed inset-0 z-[8000] overflow-hidden">
                        {/* Backdrop Blur Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsCrmPickerOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
                        />

                        {/* Slide-Over Right Drawer Container */}
                        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                                className="w-screen max-w-xl bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/10 shadow-2xl flex flex-col h-full overflow-hidden text-left select-none"
                            >
                                {/* Drawer Header */}
                                <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/70 dark:bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
                                            <Building2 size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Import from CRM Directory</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Select contacts from CRM master to link into this project.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsCrmPickerOpen(false)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer transition"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Search Bar & Responsive Category Tabs */}
                                <div className="p-4 border-b border-gray-100 dark:border-white/5 space-y-3 bg-white dark:bg-[#161b22]">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by company name, contact, phone, email, nature of job..."
                                            value={crmPickerSearch}
                                            onChange={(e) => setCrmPickerSearch(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 font-medium text-gray-900 dark:text-white"
                                        />
                                    </div>

                                    {/* Category Filter Tabs */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                                        {['All', ...CATEGORY_OPTIONS].map(cat => {
                                            const isSelected = crmPickerCategory === cat;
                                            const count = cat === 'All'
                                                ? allAvailableCrmContacts.length
                                                : allAvailableCrmContacts.filter(c => c.category === cat).length;
                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => setCrmPickerCategory(cat)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                                        isSelected
                                                            ? 'bg-blue-600 text-white shadow-2xs font-bold'
                                                            : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                                    }`}
                                                >
                                                    {cat} <span className="text-[10px] opacity-75 font-mono">({count})</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Quick Selection Toolbar */}
                                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
                                        <span>
                                            Showing {filteredAvailableCrmContacts.length} of {allAvailableCrmContacts.length} contacts
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (crmSelectedIds.size === filteredAvailableCrmContacts.length) {
                                                    setCrmSelectedIds(new Set());
                                                } else {
                                                    setCrmSelectedIds(new Set(filteredAvailableCrmContacts.map(c => c.id)));
                                                }
                                            }}
                                            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                                        >
                                            {crmSelectedIds.size === filteredAvailableCrmContacts.length ? 'Deselect All' : 'Select All Filtered'}
                                        </button>
                                    </div>
                                </div>

                                {/* Contact List Content */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                                    {filteredAvailableCrmContacts.length === 0 ? (
                                        <div className="py-20 text-center text-gray-400 text-xs flex flex-col items-center justify-center space-y-2">
                                            <Building2 size={32} className="opacity-40" />
                                            <p className="font-semibold">No contacts found for the selected category</p>
                                            <p className="text-[11px] text-gray-400">Try changing the category or clearing the search term.</p>
                                        </div>
                                    ) : (
                                        filteredAvailableCrmContacts.map(c => {
                                            const isChecked = crmSelectedIds.has(c.id);
                                            return (
                                                <div
                                                    key={c.id}
                                                    onClick={() => {
                                                        setCrmSelectedIds(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(c.id)) next.delete(c.id);
                                                            else next.add(c.id);
                                                            return next;
                                                        });
                                                    }}
                                                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                                        isChecked
                                                            ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-300 dark:border-blue-500/40 shadow-xs'
                                                            : 'bg-white dark:bg-[#0d1117]/60 border-gray-200/80 dark:border-white/5 hover:border-blue-200 dark:hover:border-white/10'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 shrink-0">
                                                            <CustomCheckbox checked={isChecked} onChange={() => {}} />
                                                        </div>
                                                        <div className="flex-1 min-w-0 space-y-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                                    {c.name}
                                                                </h4>
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${CATEGORY_BADGE_STYLES[c.category] || CATEGORY_BADGE_STYLES.Other}`}>
                                                                    {c.category}
                                                                </span>
                                                            </div>
                                                            {c.job_name && (
                                                                <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                                                    {c.job_name}
                                                                </div>
                                                            )}
                                                            <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
                                                                {c.contact_person && (
                                                                    <div>Contact: <span className="font-semibold text-gray-700 dark:text-gray-300">{c.contact_person}</span> {c.designation ? `(${c.designation})` : ''}</div>
                                                                )}
                                                                {[c.telephone_no, c.email, c.address].filter(Boolean).length > 0 && (
                                                                    <div className="truncate">
                                                                        {[c.telephone_no, c.email, c.address].filter(Boolean).join(' • ')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Drawer Sticky Footer */}
                                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02] flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {crmSelectedIds.size} contact(s) selected
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsCrmPickerOpen(false)}
                                            className="px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleImportSelectedCrmContacts}
                                            disabled={crmSelectedIds.size === 0}
                                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                        >
                                            Add to Project ({crmSelectedIds.size})
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

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
                                transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                                className="w-screen max-w-2xl bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/10 shadow-2xl flex flex-col h-full overflow-hidden text-left select-none"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Drawer Header */}
                                <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/70 dark:bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
                                            <FileSpreadsheet size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Import & Paste from Excel</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Upload spreadsheet or paste copied cells to preview and add to project.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsExcelModalOpen(false)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer transition"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Source Selector Tabs */}
                                <div className="px-6 pt-3 pb-2 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#161b22]">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setExcelModalTab('upload')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                                excelModalTab === 'upload'
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                            }`}
                                        >
                                            <UploadCloud size={13} />
                                            <span>Upload Spreadsheet</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExcelModalTab('paste')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                                excelModalTab === 'paste'
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                            }`}
                                        >
                                            <ClipboardPaste size={13} />
                                            <span>Paste from Excel</span>
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => downloadExcelTemplateFile(false)}
                                        className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                                        title="Download clean blank Excel template"
                                    >
                                        <Download size={12} />
                                        <span>Download Template</span>
                                    </button>
                                </div>

                                {/* Drawer Scrollable Content */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {/* Input controls based on active tab */}
                                    {excelModalTab === 'upload' && (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-gray-300 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition bg-gray-50/50 dark:bg-white/[0.02] flex flex-col items-center justify-center gap-2 group"
                                        >
                                            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                                                <UploadCloud size={24} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                                    {excelSourceFileName ? `Selected: ${excelSourceFileName}` : 'Click to upload or drag & drop Excel / CSV file'}
                                                </p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">
                                                    Supports .xlsx, .xls, and .csv files
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {excelModalTab === 'paste' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                    Paste copied cells from Excel:
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            if (navigator.clipboard && navigator.clipboard.readText) {
                                                                const txt = await navigator.clipboard.readText();
                                                                if (txt && txt.trim()) {
                                                                    setExcelPasteText(txt);
                                                                    const rawRows = parseExcelClipboardText(txt);
                                                                    const parsed = parseRawRowsToParties(rawRows, selectedCategoryFilter);
                                                                    setExcelParsedParties(parsed);
                                                                    setExcelSourceFileName('Clipboard Data');
                                                                } else {
                                                                    showToast('info', 'Clipboard Empty', 'No text found in clipboard. Copy cells from Excel first.');
                                                                }
                                                            }
                                                        } catch (e) {
                                                            showToast('info', 'Paste Manually', 'Please press Ctrl+V directly into the text box.');
                                                        }
                                                    }}
                                                    className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <ClipboardPaste size={12} />
                                                    <span>Paste from Clipboard</span>
                                                </button>
                                            </div>
                                            <textarea
                                                rows={4}
                                                value={excelPasteText}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setExcelPasteText(val);
                                                    const rawRows = parseExcelClipboardText(val);
                                                    const parsed = parseRawRowsToParties(rawRows, selectedCategoryFilter);
                                                    setExcelParsedParties(parsed);
                                                    setExcelSourceFileName('Pasted Data');
                                                }}
                                                placeholder="Copy cells in Excel (Ctrl+C) and paste (Ctrl+V) here to preview..."
                                                className="w-full p-3 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-mono outline-none focus:border-blue-500 dark:text-white"
                                            />
                                        </div>
                                    )}

                                    {/* Data Preview Section */}
                                    {excelParsedParties.length > 0 ? (
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                                    <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
                                                    <span>{excelParsedParties.length} party row(s) ready to import</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setExcelParsedParties([]);
                                                        setExcelPasteText('');
                                                        setExcelSourceFileName('');
                                                    }}
                                                    className="text-xs text-gray-500 hover:text-red-500 font-semibold cursor-pointer"
                                                >
                                                    Clear
                                                </button>
                                            </div>

                                            {/* Preview Cards List */}
                                            <div className="space-y-2.5">
                                                {excelParsedParties.map((p, idx) => (
                                                    <div
                                                        key={p.id || idx}
                                                        className="p-3.5 bg-gray-50/70 dark:bg-[#0d1117]/60 border border-gray-200/80 dark:border-white/10 rounded-xl space-y-1.5"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-mono text-gray-400">#{idx + 1}</span>
                                                                <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                                                    {p.name || <span className="text-red-500 italic">No Company Name</span>}
                                                                </h4>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${CATEGORY_BADGE_STYLES[p.category] || CATEGORY_BADGE_STYLES.Other}`}>
                                                                {p.category}
                                                            </span>
                                                        </div>

                                                        {p.job_name && (
                                                            <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                                                {p.job_name}
                                                            </div>
                                                        )}

                                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
                                                            {p.contact_person && (
                                                                <div>
                                                                    Contact: <span className="font-semibold text-gray-700 dark:text-gray-300">{p.contact_person}</span> {p.designation ? `(${p.designation})` : ''}
                                                                </div>
                                                            )}
                                                            {[p.telephone_no, p.email, p.address].filter(Boolean).length > 0 && (
                                                                <div className="truncate text-gray-600 dark:text-gray-400">
                                                                    {[p.telephone_no, p.email, p.address].filter(Boolean).join(' • ')}
                                                                </div>
                                                            )}
                                                            {p.remarks && (
                                                                <div className="text-[10px] text-gray-400 italic">
                                                                    Note: {p.remarks}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center space-y-2 border border-dashed border-gray-200 dark:border-white/5 rounded-xl">
                                            <FileSpreadsheet size={32} className="opacity-30" />
                                            <p className="font-semibold">No data parsed yet</p>
                                            <p className="text-[11px] text-gray-400">Upload a spreadsheet or paste data above to see the live preview.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Drawer Sticky Footer */}
                                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02] flex flex-col gap-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-gray-700 dark:text-gray-300">Import Mode:</span>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-gray-300">
                                                <input
                                                    type="radio"
                                                    name="importMode"
                                                    value="append"
                                                    checked={excelImportMode === 'append'}
                                                    onChange={() => setExcelImportMode('append')}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>Append to list</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-gray-300">
                                                <input
                                                    type="radio"
                                                    name="importMode"
                                                    value="replace"
                                                    checked={excelImportMode === 'replace'}
                                                    onChange={() => setExcelImportMode('replace')}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>Replace all</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsExcelModalOpen(false)}
                                            className="px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={excelParsedParties.length === 0}
                                            onClick={() => {
                                                if (excelParsedParties.length > 0) {
                                                    pushUndoState(gridDataRef.current);
                                                    if (excelImportMode === 'append') {
                                                        setGridData(prev => [...excelParsedParties, ...prev]);
                                                    } else {
                                                        setGridData(excelParsedParties);
                                                    }
                                                    setIsExcelModalOpen(false);
                                                    const count = excelParsedParties.length;
                                                    setExcelParsedParties([]);
                                                    setExcelPasteText('');
                                                    setExcelSourceFileName('');
                                                    showToast('sparkle', 'Imported Successfully', `Added ${count} project party row(s) to the project.`);
                                                }
                                            }}
                                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                        >
                                            Add to Project ({excelParsedParties.length})
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
                accept=".xlsx, .xls, .csv"
                className="hidden"
            />

            {/* Confirm Action Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                variant={confirmModal.variant}
            />

            {/* Toast Notification */}
            {toast && (
                <Toast
                    toast={toast}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default ProjectPartiesList;
