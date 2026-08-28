import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2,
    Plus,
    SlidersHorizontal,
    Sparkles
} from 'lucide-react';
import api from '../../services/api';
import vendorApi from '../../services/vendorApi';
import VendorDetails from './VendorDetails';
import VendorFilterDropdown from './VendorFilterDropdown';
import AddEditVendor from './AddEditVendor';
import ManageMetadataModal from '../../components/ManageMetadataModal';
import DuplicateResolverModal from '../../components/DuplicateResolverModal';
import { ExcelGrid } from '../../components/ExcelGrid';
import { useAuth } from '../../context/AuthContext';

const CATEGORY_OPTIONS = [
    'Consultant',
    'Contractor',
    'Supplier',
    'Manufacturer',
    'Service Provider',
    'Other'
];

const CATEGORY_BADGE_STYLES = {
    Consultant: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-500/20',
    Contractor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/20',
    Supplier: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500/20',
    Manufacturer: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-500/20',
    'Service Provider': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-500/20',
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
    remarks: ['remarks', 'notes', 'comments', 'description', 'remark', 'note']
};

export const VendorsList = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('vendors', 2);

    const [vendors, setVendors] = useState([]);
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
    const fetchVendors = async () => {
        setIsLoading(true);
        try {
            const res = await vendorApi.getVendors({ limit: 50000 });
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
        fetchVendors();
    }, []);

    // Filtered data by category / job filters
    const filteredVendors = useMemo(() => {
        const hasCategories = activeFilters.categories.length > 0;
        const hasJobs = activeFilters.jobs.length > 0;
        if (!hasCategories && !hasJobs) return vendors;

        const catSet = new Set(activeFilters.categories);
        const jobSet = new Set(activeFilters.jobs);

        return vendors.filter((v) => {
            if (hasCategories && !catSet.has(v.category)) return false;
            if (hasJobs && !jobSet.has(v.job_name)) return false;
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
                aliases: COLUMN_ALIASES.name
            },
            {
                key: 'category',
                label: 'Category',
                type: 'select',
                options: CATEGORY_OPTIONS,
                defaultValue: 'Contractor',
                width: '160px',
                minWidth: '150px',
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
            }
        ];
    }, [allJobNatures]);

    // Batch Save Handler
    const handleSaveGridBatch = async (payload) => {
        const { created, updated, deleted } = payload;

        if (deleted.length > 0) {
            await vendorApi.deleteVendors(deleted);
        }

        if (created.length > 0) {
            for (const item of created) {
                if (item.name && item.name.trim()) {
                    await vendorApi.createVendor(item);
                }
            }
        }

        if (updated.length > 0) {
            for (const item of updated) {
                if (item.id && item.name && item.name.trim()) {
                    await vendorApi.updateVendor(item.id, item);
                }
            }
        }

        await fetchVendors();
    };

    // View Details
    const handleViewVendorDetails = async (vendor) => {
        try {
            const res = await vendorApi.getVendorById(vendor.id);
            setViewingVendor(res?.vendor || vendor);
        } catch (err) {
            setViewingVendor(vendor);
        }
    };

    // Save from modal
    const handleSaveVendorFromModal = async (formData) => {
        try {
            if (editingVendor) {
                await vendorApi.updateVendor(editingVendor.id, formData);
            } else {
                await vendorApi.createVendor(formData);
            }
            setIsAddModalOpen(false);
            setEditingVendor(null);
            fetchVendors();
        } catch (err) {
            console.error('Failed to save vendor from modal:', err);
        }
    };

    // Delete duplicates
    const handleConfirmDeleteDuplicates = async (idsToDelete) => {
        if (!idsToDelete || idsToDelete.length === 0) return;
        await vendorApi.deleteVendors(idsToDelete);
        fetchVendors();
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
                onViewRow={handleViewVendorDetails}
                onEditRow={(vendor) => {
                    setEditingVendor(vendor);
                    setIsAddModalOpen(true);
                }}
                emptyMessage="No vendors found in database"
                extraFilters={
                    <VendorFilterDropdown
                        activeFilters={activeFilters}
                        setActiveFilters={setActiveFilters}
                        categoryOptions={CATEGORY_OPTIONS}
                        allJobNatures={allJobNatures}
                        filterCategorySearch={filterCategorySearch}
                        setFilterCategorySearch={setFilterCategorySearch}
                        filterJobSearch={filterJobSearch}
                        setFilterJobSearch={setFilterJobSearch}
                    />
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
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-white/10 transition cursor-pointer"
                                    title="Check & Resolve Duplicates"
                                >
                                    <Sparkles size={13} className="text-purple-500" />
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
                onClose={() => setViewingVendor(null)}
                onEdit={(v) => {
                    setEditingVendor(v);
                    setIsAddModalOpen(true);
                    setViewingVendor(null);
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
                    categoryOptions={CATEGORY_OPTIONS}
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
                />
            )}

            {/* ─── Duplicate Resolver Modal ─── */}
            {isDuplicateModalOpen && (
                <DuplicateResolverModal
                    isOpen={isDuplicateModalOpen}
                    onClose={() => setIsDuplicateModalOpen(false)}
                    onConfirm={handleConfirmDeleteDuplicates}
                    items={vendors}
                    primaryKey="name"
                    entityName="Vendors"
                />
            )}
        </div>
    );
};

export default VendorsList;
