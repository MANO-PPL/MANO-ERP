import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Building2,
    Plus,
    SlidersHorizontal,
    CopyCheck,
    ChevronDown,
    Check
} from 'lucide-react';
import api from '../../services/api';
import { createPartyApi } from '../../services/partyApi';
import { toast } from 'react-toastify';
import VendorDetails from './VendorDetails';
import VendorFilterDropdown from './VendorFilterDropdown';
import AddEditVendor from './AddEditVendor';
import ManageMetadataModal from '../../components/ManageMetadataModal';
import PartyStatusFilter from '../../components/PartyStatusFilter';
import PartyReasonModal from '../../components/PartyReasonModal';
import { ExcelGrid } from '../../components/ExcelGrid';
import { evaluateFormula } from '../../utils/excelFormulaEngine';
import { useAuth } from '../../context/AuthContext';

const vendorApi = createPartyApi('vendor');

const CATEGORY_OPTIONS = [
    'Consultant',
    'Contractor',
    'Supplier',
    'Manufacturer',
    'Other'
];

const CATEGORY_BADGE_STYLES = {
    Consultant: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-500/20',
    Contractor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/20',
    Supplier: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500/20',
    Manufacturer: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-500/20',
    Other: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'
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
    remarks: ['remarks', 'notes', 'comments', 'description', 'remark', 'note'],
    created_at: ['created at', 'created_at', 'created on', 'creation date', 'date created', 'created']
};

export const VendorsList = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('vendors', 2);

    const [vendors, setVendors] = useState([]);
    const [statusFilter, setStatusFilter] = useState('active');
    const [isLoading, setIsLoading] = useState(true);
    const [allJobNatures, setAllJobNatures] = useState([]);

    // Filters
    const [activeFilters, setActiveFilters] = useState({ categories: [], jobs: [] });
    const [filterCategorySearch, setFilterCategorySearch] = useState('');
    const [filterJobSearch, setFilterJobSearch] = useState('');

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [viewingVendor, setViewingVendor] = useState(null);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [reasonAction, setReasonAction] = useState(null); // { row, type: 'archive' | 'restore' | 'delete' }
    const [isJobNatureModalOpen, setIsJobNatureModalOpen] = useState(false);

    // Fetch Metadata
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

    // Fetch Vendors List
    const fetchVendors = async (targetStatus = statusFilter) => {
        setIsLoading(true);
        try {
            const res = await vendorApi.list({ limit: 50000, status: targetStatus });
            const list = res.vendors || [];
            setVendors(list);
        } catch (err) {
            console.error('Failed to fetch vendors:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMetadata();
    }, []);

    useEffect(() => {
        fetchVendors(statusFilter);
    }, [statusFilter]);

    // Filtered data by category / job filters
    const filteredVendors = useMemo(() => {
        const categories = activeFilters?.categories || [];
        const jobs = activeFilters?.jobs || [];
        const hasCategories = categories.length > 0;
        const hasJobs = jobs.length > 0;
        if (!hasCategories && !hasJobs) return vendors;

        const catSet = new Set(categories.map((c) => String(c).trim().toLowerCase()));
        const jobSet = new Set(jobs.map((j) => String(j).trim().toLowerCase()));

        return vendors.filter((v) => {
            if (hasCategories) {
                const cat = v.category ? String(v.category).trim().toLowerCase() : '';
                if (!catSet.has(cat)) return false;
            }
            if (hasJobs) {
                const job = v.job_name ? String(v.job_name).trim().toLowerCase() : '';
                if (!jobSet.has(job)) return false;
            }
            return true;
        });
    }, [vendors, activeFilters]);

    // Stats calculations
    const stats = useMemo(
        () => ({
            total: vendors.length,
            categoriesCount: new Set(vendors.map((v) => v.category).filter(Boolean)).size,
            jobNaturesCount: allJobNatures.length,
            hasPhone: vendors.filter((v) => v.telephone_no || v.mobile).length
        }),
        [vendors, allJobNatures]
    );

    // Aggregate comprehensive list of Nature of Job options
    const jobOptions = useMemo(() => {
        const set = new Set();
        (allJobNatures || []).forEach((j) => {
            const name = typeof j === 'object' ? j?.job_name || j?.name : String(j || '');
            if (name && name.trim()) set.add(name.trim());
        });
        (vendors || []).forEach((v) => {
            const name = v?.job_name || v?.job_nature;
            if (name && String(name).trim()) set.add(String(name).trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [allJobNatures, vendors]);

    // Column Definitions for ExcelGrid
    const columns = useMemo(() => {
        return [
            {
                key: 'name',
                label: 'Company Name',
                required: true,
                width: '220px',
                minWidth: '200px',
                aliases: COLUMN_ALIASES.name
            },
            {
                key: 'category',
                label: 'Category',
                type: 'select',
                options: CATEGORY_OPTIONS,
                defaultValue: '',
                placeholder: 'Select category...',
                width: '165px',
                minWidth: '155px',
                aliases: COLUMN_ALIASES.category,
                renderCell: (val) => {
                    if (!val) {
                        return <span className="text-gray-400 font-normal italic text-[11px]">Select category...</span>;
                    }
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
                placeholder: '-- Select Trade --',
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
                key: 'location',
                label: 'Location',
                width: '150px',
                minWidth: '140px',
                aliases: COLUMN_ALIASES.location
            },
            {
                key: 'remarks',
                label: 'Remarks',
                width: '200px',
                minWidth: '180px',
                aliases: COLUMN_ALIASES.remarks
            },
            {
                key: 'created_at',
                label: 'Created At',
                width: '150px',
                minWidth: '130px',
                readOnly: true,
                aliases: COLUMN_ALIASES.created_at,
                renderCell: (val) => {
                    if (!val) return <span className="text-gray-400 italic text-xs">—</span>;
                    try {
                        const d = new Date(val);
                        if (isNaN(d.getTime())) return <span className="text-xs text-gray-500">{String(val)}</span>;
                        return (
                            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium" title={d.toLocaleString()}>
                                {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        );
                    } catch {
                        return <span className="text-xs text-gray-500">{String(val)}</span>;
                    }
                }
            }
        ];
    }, [jobOptions, canWrite]);

    // Unified single-transaction batch save connecting to vendorApi
    const handleSaveGridBatch = async (payload) => {
        const { created = [], updated = [], deleted = [] } = payload;

        const resolveItemValues = (item) => {
            const clean = { ...item };
            Object.entries(clean).forEach(([k, v]) => {
                if (typeof v === 'string' && v.trim().startsWith('=')) {
                    const evalRes = evaluateFormula(v, item);
                    clean[k] = evalRes.success ? (evalRes.result ?? '') : v;
                }
            });
            return clean;
        };

        const resolvedCreated = created
            .map(resolveItemValues)
            .filter((item) => item.name && String(item.name).trim());

        const resolvedUpdated = updated
            .map(resolveItemValues)
            .filter((item) => item.id && item.name && String(item.name).trim());

        const realDeleted = (deleted || []).filter((id) => id && !String(id).startsWith('temp_'));

        await vendorApi.batchSave({
            created: resolvedCreated,
            updated: resolvedUpdated,
            deleted: realDeleted
        });

        await fetchVendors();
    };

    // View Details
    const handleViewVendorDetails = async (vendor) => {
        if (!vendor) return;
        const isTemp = !vendor.id || String(vendor.id).startsWith('temp_') || isNaN(Number(vendor.id));
        if (isTemp) {
            toast.warning('Please save this vendor before viewing details.');
            return;
        }
        try {
            const res = await vendorApi.getById(vendor.id);
            setViewingVendor(res?.vendor || vendor);
        } catch (err) {
            setViewingVendor(vendor);
        }
    };

    // Save from modal
    const handleSaveVendorFromModal = async (formData) => {
        try {
            if (editingVendor) {
                await vendorApi.update(editingVendor.id, formData);
                toast.success('Vendor updated successfully');
            } else {
                await vendorApi.create(formData);
                toast.success('Vendor created successfully');
            }
            setIsAddModalOpen(false);
            setEditingVendor(null);
            fetchVendors();
        } catch (err) {
            console.error('Failed to save vendor from modal:', err);
            const msg = err.response?.data?.message || err.message || 'Failed to save vendor';
            toast.error(msg);
        }
    };


    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117]">
            {/* Top Stats Banner */}
            <div className="px-3 pt-1.5 pb-1.5 border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="grid grid-cols-4 gap-2">
                    {[
                        {
                            id: 'total',
                            label: 'Total Vendors',
                            value: stats.total,
                            color: 'text-gray-900 dark:text-white',
                            bg: 'bg-gray-50 dark:bg-white/[0.03]'
                        },
                        {
                            id: 'categories',
                            label: 'Categories',
                            value: stats.categoriesCount,
                            color: 'text-emerald-600 dark:text-emerald-400',
                            bg: 'bg-emerald-50 dark:bg-emerald-900/10'
                        },
                        {
                            id: 'jobs',
                            label: 'Job Natures',
                            value: stats.jobNaturesCount,
                            color: 'text-purple-600 dark:text-purple-400',
                            bg: 'bg-purple-50 dark:bg-purple-900/10'
                        },
                        {
                            id: 'phone',
                            label: 'Contact Numbers',
                            value: stats.hasPhone,
                            color: 'text-blue-600 dark:text-blue-400',
                            bg: 'bg-blue-50 dark:bg-blue-900/10'
                        }
                    ].map((s) => (
                        <div
                            key={s.id}
                            className={`${s.bg} rounded-lg p-2 px-3 border border-gray-100 dark:border-white/5`}
                        >
                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {s.label}
                            </p>
                            <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Centralized ExcelGrid Component */}
            <ExcelGrid
                data={filteredVendors}
                columns={columns}
                primaryKey="id"
                entityName="Vendors"
                canWrite={canWrite}
                isLoading={isLoading}
                onSave={handleSaveGridBatch}
                onRefresh={fetchVendors}
                isDuplicateModalOpen={isDuplicateModalOpen}
                setIsDuplicateModalOpen={setIsDuplicateModalOpen}
                onViewRow={handleViewVendorDetails}
                onArchiveRow={(row) => setReasonAction({ row, type: 'archive' })}
                onRestoreRow={(row) => setReasonAction({ row, type: 'restore' })}
                onDeleteRow={(row) => setReasonAction({ row, type: 'delete' })}
                allowAddColumn={false}
                emptyMessage="No vendors found in database"
                extraFilters={
                    <div className="flex items-center gap-2">
                        <PartyStatusFilter value={statusFilter} onChange={setStatusFilter} />
                        <VendorFilterDropdown
                            activeFilters={activeFilters}
                            setActiveFilters={setActiveFilters}
                            onApply={setActiveFilters}
                            categoryOptions={CATEGORY_OPTIONS}
                            allJobNatures={allJobNatures}
                            availableJobNatures={allJobNatures}
                            vendors={vendors}
                            filterCategorySearch={filterCategorySearch}
                            setFilterCategorySearch={setFilterCategorySearch}
                            filterJobSearch={filterJobSearch}
                            setFilterJobSearch={setFilterJobSearch}
                        />
                    </div>
                }
                customActions={
                    <div className="flex items-center gap-1.5">
                        {canWrite && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingVendor(null);
                                        setIsAddModalOpen(true);
                                    }}
                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                >
                                    <Plus size={13} className="stroke-[3]" />
                                    <span>Add Vendor</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsDuplicateModalOpen(true)}
                                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                                    title="Check & Resolve Duplicate Vendors"
                                >
                                    <CopyCheck size={13} className="text-amber-500 stroke-[2.5]" />
                                    <span>Resolve Duplicates</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsJobNatureModalOpen(true)}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-white/10 transition cursor-pointer"
                                    title="Manage Job Natures"
                                >
                                    <SlidersHorizontal size={13} />
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {/* ─── Vendor Details Right Drawer ─── */}
            <VendorDetails
                vendor={viewingVendor}
                isOpen={Boolean(viewingVendor)}
                canWrite={canWrite}
                onClose={() => setViewingVendor(null)}
                onEdit={(v) => {
                    setEditingVendor(v);
                    setIsAddModalOpen(true);
                    setViewingVendor(null);
                }}
                onArchive={(id) => {
                    const target = vendors.find((v) => v.id === id) || viewingVendor;
                    setReasonAction({ row: target, type: 'archive' });
                }}
                onRestore={(id) => {
                    const target = vendors.find((v) => v.id === id) || viewingVendor;
                    setReasonAction({ row: target, type: 'restore' });
                }}
                onDelete={(id) => {
                    const target = vendors.find((v) => v.id === id) || viewingVendor;
                    setReasonAction({ row: target, type: 'delete' });
                }}
                onUpdate={async () => {
                    if (viewingVendor?.id && !String(viewingVendor.id).startsWith('temp_') && !isNaN(Number(viewingVendor.id))) {
                        try {
                            const res = await vendorApi.getById(viewingVendor.id);
                            if (res?.vendor) setViewingVendor(res.vendor);
                        } catch (err) {
                            console.error('Failed to refresh viewing vendor:', err);
                        }
                    }
                    fetchVendors(statusFilter);
                }}
            />

            {/* ─── Add / Edit Vendor Modal ─── */}
            {isAddModalOpen && (
                <AddEditVendor
                    isOpen={isAddModalOpen}
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setEditingVendor(null);
                    }}
                    onSave={handleSaveVendorFromModal}
                    initialData={editingVendor}
                    allJobNatures={allJobNatures}
                    jobOptions={jobOptions}
                    categoryOptions={CATEGORY_OPTIONS}
                    onRefreshMetadata={fetchMetadata}
                />
            )}

            {/* ─── Manage Metadata Modal ─── */}
            {isJobNatureModalOpen && (
                <ManageMetadataModal
                    isOpen={isJobNatureModalOpen}
                    onClose={() => {
                        setIsJobNatureModalOpen(false);
                        fetchMetadata();
                    }}
                    type="job_natures"
                    title="Manage Nature of Jobs"
                    onUpdate={fetchMetadata}
                />
            )}

            <PartyReasonModal
                action={reasonAction}
                entityLabel="Vendor"
                onArchive={vendorApi.archive}
                onRestore={vendorApi.restore}
                onDelete={vendorApi.remove}
                onClose={() => setReasonAction(null)}
                onSuccess={() => {
                    setReasonAction(null);
                    setViewingVendor(null);
                    fetchVendors(statusFilter);
                }}
            />
        </div>
    );
};

export default VendorsList;
