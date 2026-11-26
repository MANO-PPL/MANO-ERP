import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    ChevronDown,
    Check,
    Plus,
    SlidersHorizontal,
    Trash2,
    Calendar,
    Phone,
    Mail,
    MessageSquare,
    MapPin,
    Users,
    Clock,
    History
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import ManageMetadataModal from '../../components/ManageMetadataModal';
import PartyContactsRepeater, { buildInitialContactPersons } from '../../components/PartyContactsRepeater';

const INTERACTION_TYPES = [
    { type: 'Call', label: 'Call', icon: Phone },
    { type: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
    { type: 'Email', label: 'Email', icon: Mail },
    { type: 'Site Visit', label: 'Site Visit', icon: MapPin },
    { type: 'Meeting', label: 'Meeting', icon: Users }
];

/**
 * Modal form for adding or updating client organization records, sectors, and job nature classifications.
 */
const AddEditClient = ({
    isOpen,
    onClose,
    onSave,
    initialData = null,
    allJobNatures = [],
    availableJobNatures = [],
    allSectors = [],
    availableSectors = [],
    jobOptions = [],
    sectorOptions = [],
    onRefreshMetadata
}) => {
    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        designation: '',
        email: '',
        contact_no: '',
        website: '',
        address: '',
        reference: '',
        remarks: '',
        job_nature: '',
        location: '',
        sector: '',
        responsibility: ''
    });

    const [sectorSearch, setSectorSearch] = useState('');
    const [contactPersons, setContactPersons] = useState([]);
    const [jobNatureSearch, setJobNatureSearch] = useState('');
    const [showSectorDropdown, setShowSectorDropdown] = useState(false);
    const [showJobNatureDropdown, setShowJobNatureDropdown] = useState(false);
    const [isAddingJobNature, setIsAddingJobNature] = useState(false);
    const [isAddingSector, setIsAddingSector] = useState(false);
    const [interactions, setInteractions] = useState([]);

    const handleAddInteraction = () => {
        setInteractions((prev) => [
            ...prev,
            {
                id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'Call',
                interaction_date: new Date().toISOString().split('T')[0],
                follow_up_date: '',
                remarks: ''
            }
        ]);
    };

    const handleRemoveInteraction = (index) => {
        setInteractions((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleInteractionChange = (index, field, value) => {
        setInteractions((prev) =>
            prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
        );
    };

    // Manage Metadata Modal State
    const [metadataModal, setMetadataModal] = useState({
        isOpen: false,
        type: 'job_natures',
        title: 'Manage Nature of Jobs'
    });

    const jobNatureContainerRef = useRef(null);
    const sectorContainerRef = useRef(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (jobNatureContainerRef.current && !jobNatureContainerRef.current.contains(e.target)) {
                setShowJobNatureDropdown(false);
            }
            if (sectorContainerRef.current && !sectorContainerRef.current.contains(e.target)) {
                setShowSectorDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Combine previous values from metadata lists, passed options, and existing records
    const combinedJobOptions = useMemo(() => {
        const set = new Set();
        (jobOptions || []).forEach((o) => o && set.add(String(o).trim()));
        (allJobNatures.length ? allJobNatures : availableJobNatures || []).forEach((j) => {
            const name = typeof j === 'object' ? (j?.job_name || j?.name) : String(j || '');
            if (name && name.trim()) set.add(name.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [jobOptions, allJobNatures, availableJobNatures]);

    const combinedSectorOptions = useMemo(() => {
        const set = new Set();
        (sectorOptions || []).forEach((o) => o && set.add(String(o).trim()));
        (allSectors.length ? allSectors : availableSectors || []).forEach((s) => {
            const name = typeof s === 'object' ? (s?.sector_name || s?.name) : String(s || '');
            if (name && name.trim()) set.add(name.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [sectorOptions, allSectors, availableSectors]);

    // Filtered lists based on current user search text
    const filteredJobNatures = useMemo(() => {
        const query = jobNatureSearch.trim().toLowerCase();
        if (!query) return combinedJobOptions;
        return combinedJobOptions.filter((j) => j.toLowerCase().includes(query));
    }, [combinedJobOptions, jobNatureSearch]);

    const filteredSectors = useMemo(() => {
        const query = sectorSearch.trim().toLowerCase();
        if (!query) return combinedSectorOptions;
        return combinedSectorOptions.filter((s) => s.toLowerCase().includes(query));
    }, [combinedSectorOptions, sectorSearch]);

    // Check if the typed value is completely new (not in existing options)
    const isNewJobNature = Boolean(
        jobNatureSearch.trim() &&
        !combinedJobOptions.some((j) => j.toLowerCase() === jobNatureSearch.trim().toLowerCase())
    );

    const isNewSector = Boolean(
        sectorSearch.trim() &&
        !combinedSectorOptions.some((s) => s.toLowerCase() === sectorSearch.trim().toLowerCase())
    );

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                contact_person: initialData.contact_person || '',
                designation: initialData.designation || '',
                email: initialData.email || '',
                contact_no: initialData.contact_no || initialData.telephone_no || initialData.mobile || '',
                website: initialData.website || '',
                address: initialData.address || '',
                reference: initialData.reference || '',
                remarks: initialData.remarks || initialData.self_remark || '',
                job_nature: initialData.job_name || initialData.job_nature || '',
                location: initialData.location || '',
                sector: initialData.sector_name || initialData.sector || '',
                responsibility: initialData.responsibility || ''
            });
            setSectorSearch(initialData.sector_name || initialData.sector || '');
            setJobNatureSearch(initialData.job_name || initialData.job_nature || '');
            setContactPersons(buildInitialContactPersons(initialData));
            setInteractions([]);
        } else {
            setFormData({
                name: '',
                contact_person: '',
                designation: '',
                email: '',
                contact_no: '',
                website: '',
                address: '',
                reference: '',
                remarks: '',
                job_nature: '',
                location: '',
                sector: '',
                responsibility: ''
            });
            setSectorSearch('');
            setJobNatureSearch('');
            setContactPersons(buildInitialContactPersons(null));
            setInteractions([]);
        }
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const validInteractions = interactions
            .filter((i) => i.type && (i.interaction_date || i.remarks?.trim() || i.follow_up_date))
            .map((i) => ({
                type: i.type,
                interaction_date: i.interaction_date || new Date().toISOString().split('T')[0],
                follow_up_date: i.follow_up_date || null,
                remarks: i.remarks?.trim() || null
            }));

        const primaryPoc = contactPersons.find((c) => c.is_primary) || contactPersons[0] || {};
        onSave({
            ...formData,
            contact_person: primaryPoc.name || formData.contact_person || '',
            designation: primaryPoc.designation || formData.designation || '',
            contact_no: primaryPoc.telephone_no || formData.contact_no || '',
            telephone_no: primaryPoc.telephone_no || formData.contact_no || '',
            mobile: primaryPoc.mobile || '',
            email: primaryPoc.email || formData.email || '',
            contact_persons: contactPersons,
            interactions: validInteractions
        });
        onClose();
    };

    // Quick add new Nature of Job
    const handleQuickAddJobNature = async (name) => {
        const val = (name || jobNatureSearch).trim();
        if (!val) return;
        setIsAddingJobNature(true);
        try {
            await api.post('/admin/job-natures', { job_name: val });
            toast.success(`"${val}" added to Nature of Jobs`);
            if (onRefreshMetadata) onRefreshMetadata();
        } catch (err) {
            console.error('Failed to create job nature:', err);
        } finally {
            setIsAddingJobNature(false);
        }
        setFormData((prev) => ({ ...prev, job_nature: val }));
        setJobNatureSearch(val);
        setShowJobNatureDropdown(false);
    };

    // Quick add new Sector
    const handleQuickAddSector = async (name) => {
        const val = (name || sectorSearch).trim();
        if (!val) return;
        setIsAddingSector(true);
        try {
            await api.post('/admin/sectors', { sector_name: val });
            toast.success(`"${val}" added to Sectors`);
            if (onRefreshMetadata) onRefreshMetadata();
        } catch (err) {
            console.error('Failed to create sector:', err);
        } finally {
            setIsAddingSector(false);
        }
        setFormData((prev) => ({ ...prev, sector: val }));
        setSectorSearch(val);
        setShowSectorDropdown(false);
    };

    const inputClasses =
        'w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow appearance-none cursor-pointer';
    const labelClasses = 'block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5';

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm z-[4999] transition-all duration-300 ease-out"
                    onClick={onClose}
                />
            )}

            {/* Right Slide-out Drawer */}
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white dark:bg-[#161b22] shadow-2xl z-[5000] transform transition-transform duration-300 flex flex-col border-l border-gray-200 dark:border-white/10 overflow-hidden ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {initialData ? 'Edit Client' : 'Add New Client'}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {initialData
                            ? 'Update the details for the selected client.'
                            : 'Fill in the details below to add a new client to the system.'}
                    </p>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                    <form id="clientForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>Company Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className={inputClasses}
                                required
                            />
                        </div>
                        <PartyContactsRepeater
                            contacts={contactPersons}
                            onChange={setContactPersons}
                            inputClasses={inputClasses}
                        />

                        <div>
                            <label className={labelClasses}>Website</label>
                            <input
                                type="text"
                                name="website"
                                value={formData.website}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className={labelClasses}>Address</label>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>

                        <div>
                            <label className={labelClasses}>Location</label>
                            <input
                                type="text"
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                                placeholder="e.g. Indore, Mumbai"
                                className={inputClasses}
                            />
                        </div>

                        {/* Nature of Job with Dropdown & Option to Add New */}
                        <div className="relative" ref={jobNatureContainerRef}>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    Nature of Job
                                </label>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setMetadataModal({
                                            isOpen: true,
                                            type: 'job_natures',
                                            title: 'Manage Nature of Jobs'
                                        })
                                    }
                                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    title="Open Manage Nature of Jobs"
                                >
                                    <Plus size={11} className="stroke-[2.5]" />
                                    <span>Add / Manage</span>
                                </button>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    name="job_nature"
                                    value={jobNatureSearch}
                                    onChange={(e) => {
                                        setJobNatureSearch(e.target.value);
                                        setFormData((prev) => ({ ...prev, job_nature: e.target.value }));
                                        setShowJobNatureDropdown(true);
                                    }}
                                    onFocus={() => setShowJobNatureDropdown(true)}
                                    placeholder="e.g. Interior Designer"
                                    className={`${inputClasses} pr-9`}
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowJobNatureDropdown((prev) => !prev)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                                >
                                    <ChevronDown
                                        size={14}
                                        className={`transition-transform duration-200 ${
                                            showJobNatureDropdown ? 'rotate-180 text-blue-500' : ''
                                        }`}
                                    />
                                </button>
                            </div>

                            {showJobNatureDropdown && (
                                <div className="absolute z-[6000] w-full mt-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-2xl max-h-56 overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95">
                                    {/* Option to create new if typed text doesn't exist */}
                                    {isNewJobNature && (
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleQuickAddJobNature(jobNatureSearch)}
                                            disabled={isAddingJobNature}
                                            className="w-full text-left px-3.5 py-2.5 bg-blue-50/70 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between transition-colors cursor-pointer"
                                        >
                                            <span className="truncate">
                                                + Add "{jobNatureSearch.trim()}" as new Nature of Job
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white shrink-0 ml-2">
                                                {isAddingJobNature ? 'Adding...' : 'Create'}
                                            </span>
                                        </button>
                                    )}

                                    {/* Scrollable list of existing values */}
                                    <div className="overflow-y-auto custom-scrollbar flex-1 max-h-40 divide-y divide-gray-100 dark:divide-white/5">
                                        {filteredJobNatures.length > 0 ? (
                                            filteredJobNatures.map((j) => (
                                                <div
                                                    key={j}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        setJobNatureSearch(j);
                                                        setFormData((prev) => ({ ...prev, job_nature: j }));
                                                        setShowJobNatureDropdown(false);
                                                    }}
                                                    className={`px-3.5 py-2 hover:bg-blue-50/70 dark:hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors text-gray-800 dark:text-gray-200 ${
                                                        formData.job_nature === j
                                                            ? 'bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold'
                                                            : ''
                                                    }`}
                                                >
                                                    <span className="truncate">{j}</span>
                                                    {formData.job_nature === j && (
                                                        <Check size={12} className="stroke-[3] text-blue-600" />
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            !isNewJobNature && (
                                                <div className="px-3.5 py-3 text-center text-gray-400 dark:text-gray-500 italic">
                                                    No previous values found
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sector with Dropdown & Option to Add New */}
                        <div className="relative" ref={sectorContainerRef}>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    Sector
                                </label>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setMetadataModal({
                                            isOpen: true,
                                            type: 'sectors',
                                            title: 'Manage Sectors'
                                        })
                                    }
                                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    title="Open Manage Sectors"
                                >
                                    <Plus size={11} className="stroke-[2.5]" />
                                    <span>Add / Manage</span>
                                </button>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    name="sector"
                                    value={sectorSearch}
                                    onChange={(e) => {
                                        setSectorSearch(e.target.value);
                                        setFormData((prev) => ({ ...prev, sector: e.target.value }));
                                        setShowSectorDropdown(true);
                                    }}
                                    onFocus={() => setShowSectorDropdown(true)}
                                    placeholder="e.g. IT, Manufacturing"
                                    className={`${inputClasses} pr-9`}
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowSectorDropdown((prev) => !prev)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                                >
                                    <ChevronDown
                                        size={14}
                                        className={`transition-transform duration-200 ${
                                            showSectorDropdown ? 'rotate-180 text-blue-500' : ''
                                        }`}
                                    />
                                </button>
                            </div>

                            {showSectorDropdown && (
                                <div className="absolute z-[6000] w-full mt-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-2xl max-h-56 overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95">
                                    {/* Option to create new if typed text doesn't exist */}
                                    {isNewSector && (
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleQuickAddSector(sectorSearch)}
                                            disabled={isAddingSector}
                                            className="w-full text-left px-3.5 py-2.5 bg-blue-50/70 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between transition-colors cursor-pointer"
                                        >
                                            <span className="truncate">
                                                + Add "{sectorSearch.trim()}" as new Sector
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white shrink-0 ml-2">
                                                {isAddingSector ? 'Adding...' : 'Create'}
                                            </span>
                                        </button>
                                    )}

                                    {/* Scrollable list of existing values */}
                                    <div className="overflow-y-auto custom-scrollbar flex-1 max-h-40 divide-y divide-gray-100 dark:divide-white/5">
                                        {filteredSectors.length > 0 ? (
                                            filteredSectors.map((s) => (
                                                <div
                                                    key={s}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        setSectorSearch(s);
                                                        setFormData((prev) => ({ ...prev, sector: s }));
                                                        setShowSectorDropdown(false);
                                                    }}
                                                    className={`px-3.5 py-2 hover:bg-blue-50/70 dark:hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors text-gray-800 dark:text-gray-200 ${
                                                        formData.sector === s
                                                            ? 'bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold'
                                                            : ''
                                                    }`}
                                                >
                                                    <span className="truncate">{s}</span>
                                                    {formData.sector === s && (
                                                        <Check size={12} className="stroke-[3] text-blue-600" />
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            !isNewSector && (
                                                <div className="px-3.5 py-3 text-center text-gray-400 dark:text-gray-500 italic">
                                                    No previous values found
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={labelClasses}>Reference</label>
                            <input
                                type="text"
                                name="reference"
                                value={formData.reference}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>Remarks</label>
                            <input
                                type="text"
                                name="remarks"
                                value={formData.remarks}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>

                        {/* ─── Interactions Section ─── */}
                        <div className="md:col-span-2 border-t border-gray-100 dark:border-white/5 pt-5 mt-1">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                        <Clock size={13} className="stroke-[2.5]" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                            Interactions
                                        </h3>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                            Log initial calls, emails, WhatsApp messages, or follow-up tasks
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddInteraction}
                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                >
                                    <Plus size={12} className="stroke-[3]" />
                                    <span>Add Interaction</span>
                                </button>
                            </div>

                            {/* Display existing interactions if editing a client with history */}
                            {initialData?.interactions && initialData.interactions.length > 0 && (
                                <div className="mb-4 p-3 bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/5 rounded-xl">
                                    <div className="flex items-center gap-1.5 mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold">
                                        <History size={12} />
                                        <span>Existing Interactions ({initialData.interactions.length})</span>
                                    </div>
                                    <div className="max-h-36 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {initialData.interactions.map((past, pIdx) => (
                                            <div
                                                key={past.id || pIdx}
                                                className="p-2 bg-white dark:bg-[#161b22] border border-gray-200/60 dark:border-white/5 rounded-lg text-xs flex items-start justify-between gap-2"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                            {past.type}
                                                        </span>
                                                        <span className="text-[11px] text-gray-400">
                                                            {past.interaction_date ? new Date(past.interaction_date).toLocaleDateString() : '—'}
                                                        </span>
                                                        {past.follow_up_date && (
                                                            <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                                                                Follow-up: {new Date(past.follow_up_date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {past.remarks && (
                                                        <p className="text-gray-600 dark:text-gray-300 text-[11px] mt-0.5 truncate">
                                                            {past.remarks}
                                                        </p>
                                                    )}
                                                </div>
                                                {past.interacted_by_name && (
                                                    <span className="text-[10px] text-gray-400 shrink-0">
                                                        by {past.interacted_by_name}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* List of New Interactions to Add */}
                            {interactions.length > 0 && (
                                <div className="space-y-3.5">
                                    {interactions.map((item, idx) => (
                                        <div
                                            key={item.id || idx}
                                            className="p-4 bg-gray-50/80 dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/10 rounded-xl space-y-3 relative transition-all"
                                        >
                                            {/* Interaction Header */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                        Interaction #{idx + 1}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveInteraction(idx)}
                                                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition cursor-pointer"
                                                    title="Remove this interaction"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {/* Interaction Type Selection */}
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                    Type <span className="text-red-500">*</span>
                                                </label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {INTERACTION_TYPES.map(({ type, icon: Icon }) => {
                                                        const isSelected = item.type?.toLowerCase() === type.toLowerCase();
                                                        return (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                onClick={() => handleInteractionChange(idx, 'type', type)}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                                                    isSelected
                                                                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-500'
                                                                        : 'bg-white dark:bg-[#161b22] hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10'
                                                                }`}
                                                            >
                                                                <Icon size={12} className={isSelected ? 'text-white' : 'text-blue-500'} />
                                                                <span>{type}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Date Fields: Interaction Date & Follow-up Date */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                        Interaction Date <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={item.interaction_date}
                                                        onChange={(e) => handleInteractionChange(idx, 'interaction_date', e.target.value)}
                                                        className="w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                        Follow-up Date (Optional)
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={item.follow_up_date || ''}
                                                        onChange={(e) => handleInteractionChange(idx, 'follow_up_date', e.target.value)}
                                                        className="w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* Remarks / Discussion Notes */}
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                                    Discussion Remarks / Notes
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    value={item.remarks}
                                                    onChange={(e) => handleInteractionChange(idx, 'remarks', e.target.value)}
                                                    placeholder="Enter summary of discussion, client requirements, or next steps..."
                                                    className="w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg p-2.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={handleAddInteraction}
                                        className="w-full py-2 bg-gray-50 hover:bg-gray-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] border border-dashed border-gray-300 dark:border-white/15 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                    >
                                        <Plus size={13} className="stroke-[2.5]" />
                                        <span>Add Another Interaction</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className="px-8 py-5 border-t border-gray-100 dark:border-white/5 flex justify-end space-x-3 bg-gray-50 dark:bg-white/[0.02]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="clientForm"
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                    >
                        {initialData ? 'Update Client' : 'Add Client'}
                    </button>
                </div>
            </div>

            {/* Embedded Manage Metadata Modal for Job Natures or Sectors */}
            {metadataModal.isOpen && (
                <ManageMetadataModal
                    isOpen={metadataModal.isOpen}
                    onClose={() => {
                        setMetadataModal((prev) => ({ ...prev, isOpen: false }));
                        if (onRefreshMetadata) onRefreshMetadata();
                    }}
                    type={metadataModal.type}
                    title={metadataModal.title}
                    onUpdate={() => {
                        if (onRefreshMetadata) onRefreshMetadata();
                    }}
                />
            )}
        </>
    );
};

export default AddEditClient;
