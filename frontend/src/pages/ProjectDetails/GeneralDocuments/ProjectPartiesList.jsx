import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus,
    UserPlus,
    Tag,
    Clock,
    Sparkles,
    Check,
    Search,
    X,
    Building2,
    Users,
    ChevronRight,
    CheckSquare,
    Square
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '../../../services/api';
import { generalDocsApi } from '../../../services/generalDocsApi';
import { workflowApi } from '../../../services/workflowApi';
import WorkflowPanel from '../../../components/WorkflowPanel';
import DuplicateResolverModal from '../../../components/DuplicateResolverModal';
import { ExcelGrid } from '../../../components/ExcelGrid';

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

const COLUMN_ALIASES = {
    name: ['company name', 'party name', 'name', 'vendor name', 'client name', 'firm', 'agency', 'contractor name'],
    category: ['category', 'party category', 'type', 'role', 'classification'],
    job_name: ['nature of job', 'job nature', 'scope of work', 'scope', 'trade', 'nature', 'work nature', 'service', 'job'],
    contact_person: ['contact person', 'contact name', 'poc', 'representative', 'person', 'contact'],
    designation: ['designation', 'position', 'title', 'job title', 'role / designation'],
    telephone_no: ['contact no', 'phone no', 'mobile no', 'telephone', 'phone', 'mobile', 'cell', 'contact number', 'telephone no', 'tel'],
    email: ['email id', 'email', 'e-mail', 'mail', 'email address', 'mail id'],
    address: ['address', 'office address', 'site address', 'full address', 'street', 'location'],
    remarks: ['remarks', 'notes', 'comments', 'description', 'remark', 'note']
};

// ─── Inline CRM Auto-Suggest Editor for Company Name ───
const CrmPartyAutoSuggestEditor = ({
    value,
    row,
    onChange,
    onBlur,
    rowIndex,
    onChangeValue,
    crmSuggestions = []
}) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [isOpen, setIsOpen] = useState(true);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 300 });
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        const updateCoords = () => {
            if (inputRef.current) {
                const rect = inputRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom + 4,
                    left: rect.left,
                    width: Math.max(300, rect.width)
                });
            }
        };
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [isOpen, inputValue]);

    const filtered = useMemo(() => {
        const q = String(inputValue || '').trim().toLowerCase();
        if (!q) return crmSuggestions.slice(0, 8);
        return crmSuggestions
            .filter(
                (c) =>
                    (c.name || '').toLowerCase().includes(q) ||
                    (c.contact_person || '').toLowerCase().includes(q) ||
                    (c.category || '').toLowerCase().includes(q)
            )
            .slice(0, 8);
    }, [inputValue, crmSuggestions]);

    const handleSelectSuggestion = (item) => {
        setInputValue(item.name);
        setIsOpen(false);
        onChange(item.name);

        // Autofill all relevant fields for this party row
        if (onChangeValue) {
            onChangeValue(rowIndex, 'name', item.name);
            if (item.category) onChangeValue(rowIndex, 'category', item.category);
            if (item.job_nature || item.job_name) {
                onChangeValue(rowIndex, 'job_name', item.job_nature || item.job_name);
            }
            if (item.contact_person || item.contact_name) {
                onChangeValue(rowIndex, 'contact_person', item.contact_person || item.contact_name);
            }
            if (item.designation) onChangeValue(rowIndex, 'designation', item.designation);
            if (item.telephone_no || item.phone) {
                onChangeValue(rowIndex, 'telephone_no', item.telephone_no || item.phone);
            }
            if (item.email) onChangeValue(rowIndex, 'email', item.email);
            if (item.address) onChangeValue(rowIndex, 'address', item.address);
            if (item.remarks) onChangeValue(rowIndex, 'remarks', item.remarks);
        }
        onBlur();
    };

    return (
        <div className="relative w-full h-full flex items-center">
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    onChange(e.target.value);
                    setIsOpen(true);
                    setHighlightIndex(0);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightIndex(
                            (prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length)
                        );
                    } else if (e.key === 'Enter') {
                        if (isOpen && filtered[highlightIndex]) {
                            e.preventDefault();
                            handleSelectSuggestion(filtered[highlightIndex]);
                        }
                    } else if (e.key === 'Escape') {
                        setIsOpen(false);
                    }
                }}
                onBlur={() => {
                    setTimeout(() => {
                        onBlur();
                    }, 200);
                }}
                placeholder="Type name or select from CRM..."
                className="w-full min-w-0 bg-transparent border-0 outline-none p-0 text-xs font-semibold text-gray-900 dark:text-white"
            />

            {/* Dropdown Suggestions from CRM (Portaled to prevent table cell clipping) */}
            {isOpen && filtered.length > 0 && typeof document !== 'undefined' && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        zIndex: 99999,
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}
                    className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl p-1.5 space-y-1 max-h-56 overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in zoom-in-95 select-none font-sans"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between border-b border-gray-100 dark:border-white/5">
                        <span className="flex items-center gap-1">
                            <Sparkles size={11} className="text-purple-500" /> CRM Directory
                        </span>
                        <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">
                            Autofills Row
                        </span>
                    </div>

                    {filtered.map((item, idx) => (
                        <div
                            key={item.id || item.pv_id || idx}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(item);
                            }}
                            className={`p-2 rounded-lg cursor-pointer transition text-left flex items-start justify-between gap-2 ${
                                idx === highlightIndex
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                    : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200'
                            }`}
                        >
                            <div className="truncate">
                                <div className="text-xs font-bold truncate">{item.name}</div>
                                <div className="text-[10px] text-gray-400 truncate">
                                    {item.contact_person ? `POC: ${item.contact_person}` : ''}
                                    {item.telephone_no || item.phone ? ` • ${item.telephone_no || item.phone}` : ''}
                                </div>
                            </div>
                            {item.category && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 shrink-0">
                                    {item.category}
                                </span>
                            )}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export const ProjectPartiesList = ({ canWrite = true }) => {
    const { id: projectId } = useParams();

    const [parties, setParties] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [allJobNatures, setAllJobNatures] = useState([]);

    // Workflow
    const [workflowInfo, setWorkflowInfo] = useState(null);
    const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);

    // Filters
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

    // Available CRM Contacts linking sidebar drawer
    const [isLinkCrmModalOpen, setIsLinkCrmModalOpen] = useState(false);
    const [availableContacts, setAvailableContacts] = useState([]);
    const [selectedContactIdsToLink, setSelectedContactIdsToLink] = useState(new Set());
    const [crmSearchQuery, setCrmSearchQuery] = useState('');
    const [crmCategoryFilter, setCrmCategoryFilter] = useState('All');
    const [isLinking, setIsLinking] = useState(false);

    // Duplicate Resolver modal
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    // Fetch Job Natures
    const fetchMetadata = async () => {
        try {
            const res = await api.get('/admin/job-natures');
            if (res.data?.success) {
                setAllJobNatures(res.data.job_natures || []);
            }
        } catch (err) {
            console.error('Failed to fetch job natures:', err);
        }
    };

    // Fetch Project Parties
    const fetchParties = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        try {
            const res = await generalDocsApi.getParties(projectId);
            const list = (res.parties || []).map((p) => ({
                ...p,
                id: p.id || p.pv_id,
                job_name: p.job_name || p.job_nature || ''
            }));
            setParties(list);
        } catch (err) {
            console.error('Failed to load project parties:', err);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    // Pre-fetch available CRM Contacts for instant suggestions & drawer
    const fetchAvailableCrmContacts = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await generalDocsApi.getAvailableParties(projectId);
            setAvailableContacts(res.available_parties || res.parties || []);
        } catch (err) {
            console.error('Failed to load available CRM contacts:', err);
        }
    }, [projectId]);

    // Fetch Workflow Status
    const fetchWorkflow = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await workflowApi.getWorkflowStatus(projectId, 'parties');
            if (res.success && res.data) {
                setWorkflowInfo(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch workflow status:', err);
        }
    }, [projectId]);

    useEffect(() => {
        fetchMetadata();
        fetchParties();
        fetchAvailableCrmContacts();
        fetchWorkflow();
    }, [fetchParties, fetchAvailableCrmContacts, fetchWorkflow]);

    // Filtered parties by category
    const filteredParties = useMemo(() => {
        if (selectedCategoryFilter === 'All') return parties;
        return parties.filter((p) => (p.category || 'Other') === selectedCategoryFilter);
    }, [parties, selectedCategoryFilter]);

    // Filtered CRM contacts in the sidebar drawer
    const filteredCrmContacts = useMemo(() => {
        return availableContacts.filter((c) => {
            const matchesCategory =
                crmCategoryFilter === 'All' || (c.category || 'Other') === crmCategoryFilter;
            const q = crmSearchQuery.trim().toLowerCase();
            const matchesSearch =
                !q ||
                (c.name || '').toLowerCase().includes(q) ||
                (c.contact_person || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.telephone_no || '').toLowerCase().includes(q);
            return matchesCategory && matchesSearch;
        });
    }, [availableContacts, crmCategoryFilter, crmSearchQuery]);

    // Column Definitions for ExcelGrid
    const columns = useMemo(() => {
        const jobOptions = allJobNatures.map((j) => j.job_name || j.name || j);

        return [
            {
                key: 'name',
                label: 'Company Name',
                required: true,
                width: '220px',
                minWidth: '200px',
                aliases: COLUMN_ALIASES.name,
                renderEditor: (value, row, column, onChange, onBlur, rowIndex, onChangeValue) => (
                    <CrmPartyAutoSuggestEditor
                        value={value}
                        row={row}
                        onChange={onChange}
                        onBlur={onBlur}
                        rowIndex={rowIndex}
                        onChangeValue={onChangeValue}
                        crmSuggestions={availableContacts}
                    />
                )
            },
            {
                key: 'category',
                label: 'Category',
                type: 'select',
                options: CATEGORY_OPTIONS,
                defaultValue: 'Contractor',
                width: '140px',
                minWidth: '140px',
                aliases: COLUMN_ALIASES.category,
                renderCell: (val) => {
                    if (!val) return null;
                    const badgeStyle =
                        CATEGORY_BADGE_STYLES[val] ||
                        'bg-gray-100 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10';
                    return (
                        <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border truncate ${badgeStyle}`}
                        >
                            {val}
                        </span>
                    );
                }
            },
            {
                key: 'job_name',
                label: 'Nature of Job',
                type: 'select',
                options: jobOptions,
                width: '180px',
                minWidth: '170px',
                aliases: COLUMN_ALIASES.job_name
            },
            {
                key: 'contact_person',
                label: 'Contact Person',
                width: '160px',
                minWidth: '150px',
                aliases: COLUMN_ALIASES.contact_person
            },
            {
                key: 'designation',
                label: 'Designation',
                width: '150px',
                minWidth: '140px',
                aliases: COLUMN_ALIASES.designation
            },
            {
                key: 'telephone_no',
                label: 'Contact No',
                width: '140px',
                minWidth: '140px',
                aliases: COLUMN_ALIASES.telephone_no
            },
            {
                key: 'email',
                label: 'Email ID',
                width: '190px',
                minWidth: '180px',
                aliases: COLUMN_ALIASES.email
            },
            {
                key: 'address',
                label: 'Address',
                width: '240px',
                minWidth: '220px',
                aliases: COLUMN_ALIASES.address
            },
            {
                key: 'remarks',
                label: 'Remarks',
                width: '200px',
                minWidth: '180px',
                aliases: COLUMN_ALIASES.remarks
            }
        ];
    }, [allJobNatures, availableContacts]);

    // Batch Save Handler connecting to syncParties API
    const handleSaveGridBatch = async (payload) => {
        const { allRows, deleted } = payload;
        const validRows = (allRows || []).filter((r) => r.name && r.name.trim());

        await generalDocsApi.syncParties(projectId, {
            parties: validRows,
            deleted_pp_ids: deleted
        });

        await fetchParties();
        await fetchAvailableCrmContacts();
    };

    // Open Link CRM Sidebar Drawer
    const handleOpenLinkCrmDrawer = () => {
        setSelectedContactIdsToLink(new Set());
        setCrmSearchQuery('');
        setCrmCategoryFilter('All');
        setIsLinkCrmModalOpen(true);
    };

    // Commit linking CRM contacts from Sidebar
    const handleCommitLinkContacts = async () => {
        if (selectedContactIdsToLink.size === 0) return;
        setIsLinking(true);
        try {
            await generalDocsApi.addParties(projectId, Array.from(selectedContactIdsToLink));
            setIsLinkCrmModalOpen(false);
            setSelectedContactIdsToLink(new Set());
            await fetchParties();
            await fetchAvailableCrmContacts();
        } catch (err) {
            console.error('Failed to link CRM contacts:', err);
        } finally {
            setIsLinking(false);
        }
    };

    // Toggle Select All in CRM Drawer
    const handleToggleSelectAllCrm = () => {
        if (selectedContactIdsToLink.size === filteredCrmContacts.length) {
            setSelectedContactIdsToLink(new Set());
        } else {
            setSelectedContactIdsToLink(new Set(filteredCrmContacts.map((c) => c.id)));
        }
    };

    // Duplicate resolver confirm
    const handleConfirmDeleteDuplicates = async (idsToDelete) => {
        if (!idsToDelete || idsToDelete.length === 0) return;
        await generalDocsApi.syncParties(projectId, {
            parties: parties.filter((p) => !idsToDelete.includes(p.id)),
            deleted_pp_ids: idsToDelete
        });
        await fetchParties();
        await fetchAvailableCrmContacts();
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117] relative">
            {/* Centralized ExcelGrid Component */}
            <ExcelGrid
                data={filteredParties}
                columns={columns}
                primaryKey="id"
                entityName="Project Parties"
                canWrite={canWrite}
                isLoading={isLoading}
                onSave={handleSaveGridBatch}
                onRefresh={fetchParties}
                emptyMessage="No parties associated with this project"
                extraFilters={
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                        <button
                            type="button"
                            onClick={() => setSelectedCategoryFilter('All')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                                selectedCategoryFilter === 'All'
                                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                    : 'bg-white dark:bg-[#161b22] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300'
                            }`}
                        >
                            All ({parties.length})
                        </button>
                        {CATEGORY_OPTIONS.map((cat) => {
                            const count = parties.filter((p) => p.category === cat).length;
                            if (count === 0 && selectedCategoryFilter !== cat) return null;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setSelectedCategoryFilter(cat)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                                        selectedCategoryFilter === cat
                                            ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                            : 'bg-white dark:bg-[#161b22] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300'
                                    }`}
                                >
                                    {cat} ({count})
                                </button>
                            );
                        })}
                    </div>
                }
                customActions={
                    <div className="flex items-center gap-1.5">
                        {canWrite && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleOpenLinkCrmDrawer}
                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                    title="Link Existing Parties from CRM Directory"
                                >
                                    <UserPlus size={13} className="stroke-[2.5]" />
                                    <span>Link from CRM</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsDuplicateModalOpen(true)}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-white/10 transition cursor-pointer"
                                    title="Check & Resolve Duplicates"
                                >
                                    <Sparkles size={13} className="text-purple-500" />
                                </button>
                            </>
                        )}
                        {workflowInfo && (
                            <button
                                type="button"
                                onClick={() => setIsWorkflowOpen(true)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg transition cursor-pointer"
                            >
                                <Clock size={13} className="text-amber-500" />
                                <span>Workflow</span>
                            </button>
                        )}
                    </div>
                }
            />

            {/* ─── Link CRM Contacts Sidebar Popup Drawer ─── */}
            {isLinkCrmModalOpen && (
                <div
                    className="fixed inset-0 z-[6000] bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
                    onClick={() => setIsLinkCrmModalOpen(false)}
                >
                    <div
                        className="w-full max-w-md bg-white dark:bg-[#161b22] h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-200 font-sans"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="px-5 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    <UserPlus size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        Link Parties from CRM
                                    </h3>
                                    <p className="text-[11px] text-gray-400">
                                        Select existing vendors or clients to add to project
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsLinkCrmModalOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Search Bar & Categories */}
                        <div className="p-4 border-b border-gray-200 dark:border-white/10 space-y-2.5 bg-white dark:bg-[#161b22]">
                            <div className="relative">
                                <Search
                                    size={13}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                />
                                <input
                                    type="text"
                                    placeholder="Search CRM parties by name, POC, or email..."
                                    value={crmSearchQuery}
                                    onChange={(e) => setCrmSearchQuery(e.target.value)}
                                    className="w-full pl-8.5 pr-8 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                />
                                {crmSearchQuery && (
                                    <button
                                        onClick={() => setCrmSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Category Filter Chips */}
                            <div
                                className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden py-0.5"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {['All', ...CATEGORY_OPTIONS].map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCrmCategoryFilter(cat)}
                                        className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-all cursor-pointer whitespace-nowrap ${
                                            crmCategoryFilter === cat
                                                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                                                : 'bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* List of CRM Contacts */}
                        <div
                            className="flex-1 p-4 overflow-y-auto space-y-2 [&::-webkit-scrollbar]:hidden"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {filteredCrmContacts.length === 0 ? (
                                <div className="text-center py-16">
                                    <Building2 size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                        No CRM parties found
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        All available CRM contacts are already linked or no match.
                                    </p>
                                </div>
                            ) : (
                                filteredCrmContacts.map((contact) => {
                                    const isSelected = selectedContactIdsToLink.has(contact.id);
                                    return (
                                        <div
                                            key={contact.id}
                                            onClick={() => {
                                                setSelectedContactIdsToLink((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(contact.id)) next.delete(contact.id);
                                                    else next.add(contact.id);
                                                    return next;
                                                });
                                            }}
                                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                                isSelected
                                                    ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-500 dark:border-blue-600 shadow-2xs'
                                                    : 'bg-white dark:bg-[#0d1117] border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                                            }`}
                                        >
                                            <div className="truncate flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                        {contact.name}
                                                    </span>
                                                    {contact.category && (
                                                        <span
                                                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border shrink-0 ${
                                                                CATEGORY_BADGE_STYLES[contact.category] ||
                                                                'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400'
                                                            }`}
                                                        >
                                                            {contact.category}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                                                    {contact.contact_person && (
                                                        <p className="truncate">
                                                            <span className="font-semibold text-gray-700 dark:text-gray-300">POC:</span>{' '}
                                                            {contact.contact_person}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 truncate">
                                                        {contact.telephone_no && <span>{contact.telephone_no}</span>}
                                                        {contact.email && <span>• {contact.email}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div
                                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                                                    isSelected
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'border-gray-300 dark:border-white/20 hover:border-blue-500'
                                                }`}
                                            >
                                                {isSelected && <Check size={12} className="stroke-[3]" />}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Sticky Drawer Footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={handleToggleSelectAllCrm}
                                className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                            >
                                {selectedContactIdsToLink.size === filteredCrmContacts.length &&
                                filteredCrmContacts.length > 0
                                    ? 'Deselect All'
                                    : `Select All (${filteredCrmContacts.length})`}
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsLinkCrmModalOpen(false)}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={selectedContactIdsToLink.size === 0 || isLinking}
                                    onClick={handleCommitLinkContacts}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                                >
                                    <UserPlus size={13} />
                                    <span>
                                        {isLinking
                                            ? 'Linking...'
                                            : `Link (${selectedContactIdsToLink.size})`}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Workflow Slide-out Panel ─── */}
            {isWorkflowOpen && workflowInfo && (
                <WorkflowPanel
                    isOpen={isWorkflowOpen}
                    onClose={() => setIsWorkflowOpen(false)}
                    workflowId={workflowInfo.id}
                    onWorkflowUpdated={() => {
                        fetchWorkflow();
                        fetchParties();
                    }}
                />
            )}

            {/* ─── Duplicate Resolver Modal ─── */}
            {isDuplicateModalOpen && (
                <DuplicateResolverModal
                    isOpen={isDuplicateModalOpen}
                    onClose={() => setIsDuplicateModalOpen(false)}
                    onConfirm={handleConfirmDeleteDuplicates}
                    items={parties}
                    primaryKey="name"
                    entityName="Project Parties"
                />
            )}
        </div>
    );
};

export default ProjectPartiesList;
